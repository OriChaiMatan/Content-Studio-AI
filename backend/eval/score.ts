import fs from 'node:fs';
import path from 'node:path';

import { FIXTURE_BY_ID } from './fixtures';
import {
  classifyAssertion,
  findInFactCheck,
  type FactCheckLike,
  type Assertion,
} from './metrics/integrity';
import { computeSeparation, type SeparationMetrics } from './metrics/separation';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3A — SCORE (no Claude). Reads saved artifacts for the full 4×3 matrix and
// emits a deterministic report: fact-integrity findings + persona-separation
// metrics. Re-runnable infinitely; never calls the model. No LLM judge.
//
// Run:  npx tsx eval/score.ts            (scores the latest capture run)
//       npx tsx eval/score.ts <runId>    (scores a specific run)
// ─────────────────────────────────────────────────────────────────────────────

const ARTIFACTS = path.resolve(__dirname, 'artifacts');
const REPORTS = path.resolve(__dirname, 'report');

interface ClaimResult {
  claim: string;
  asserted: boolean;
  assertion: Assertion;
  mockVerified: boolean;
  mockUncertain: boolean;
  mockConflicting: boolean;
  inResearchClaims: boolean;
  why: string;
}

interface CellResult {
  fixture: string;
  persona: string;
  outputPath: string;
  generatorVersion: string;
  conflictsSurfaced: number;
  claims: ClaimResult[];
  separation: SeparationMetrics;
  failedChecks: string[];
}

function latestRunId(): string | null {
  if (!fs.existsSync(ARTIFACTS)) return null;
  const runs = fs.readdirSync(ARTIFACTS).filter(d => fs.statSync(path.join(ARTIFACTS, d)).isDirectory()).sort();
  return runs.length ? runs[runs.length - 1] : null;
}

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

function scoreCell(runDir: string, fixtureId: string, persona: string): CellResult | null {
  const fixture = FIXTURE_BY_ID[fixtureId];
  if (!fixture) return null;

  const cellDir = path.join(runDir, `${fixtureId}__${persona}`);
  const fixtureDir = path.join(runDir, fixtureId);
  const output = readJson<{ readyToPublish?: string; metadata?: { generatorVersion?: string } }>(path.join(cellDir, 'output.json'));
  const factCheck = readJson<FactCheckLike>(path.join(fixtureDir, 'factcheck.json'));
  const research = readJson<{ importantClaims?: string[] }>(path.join(fixtureDir, 'research.json'));
  if (!output || !factCheck) return null;

  const text = output.readyToPublish ?? '';
  const researchClaims = research?.importantClaims ?? [];

  const claims: ClaimResult[] = fixture.groundTruth.unsupportedClaims.map(pc => {
    const assertion = classifyAssertion(text, pc.detect);
    const fc = findInFactCheck(factCheck, pc.detect);
    const inResearchClaims = researchClaims.some(c => pc.detect.some(d => c.toLowerCase().includes(d.toLowerCase())));
    return {
      claim: pc.text,
      asserted: assertion !== 'absent',
      assertion,
      mockVerified: fc.verified.length > 0,
      mockUncertain: fc.uncertain.length > 0,
      mockConflicting: fc.conflicting.length > 0,
      inResearchClaims,
      why: pc.why,
    };
  });

  const conflictsSurfaced = (factCheck.conflictingClaims ?? []).length;
  const failedChecks: string[] = [];
  for (const c of claims) {
    if (c.assertion === 'as_fact') failedChecks.push(`Planted claim asserted AS FACT: "${c.claim}"`);
    if (c.mockVerified) failedChecks.push(`Mock fact check marked the planted claim VERIFIED (should be uncertain/projection): "${c.claim}"`);
  }
  if (conflictsSurfaced === 0 && (fixture.groundTruth.knownContradictions?.length ?? 0) > 0) {
    failedChecks.push('Known contradiction present in fixture but mock surfaced 0 conflicts.');
  }

  return {
    fixture: fixtureId,
    persona,
    outputPath: path.relative(process.cwd(), path.join(cellDir, 'output.md')),
    generatorVersion: String(output.metadata?.generatorVersion ?? 'unknown'),
    conflictsSurfaced,
    claims,
    separation: computeSeparation(text),
    failedChecks,
  };
}

function discoverCells(runDir: string): { fixtureId: string; persona: string }[] {
  return fs.readdirSync(runDir)
    .filter(d => d.includes('__') && fs.statSync(path.join(runDir, d)).isDirectory())
    .map(d => { const [fixtureId, persona] = d.split('__'); return { fixtureId, persona }; });
}

const yesNo = (b: boolean): string => (b ? '✅ yes' : '— no');
const assertLabel = (a: Assertion): string => (a === 'as_fact' ? '✅ as fact' : a === 'hedged' ? '~ hedged' : '— absent');

// ── Persona-separation comparison (per fixture) ──────────────────────────────

interface SeparationCheck {
  fixture: string;
  byPersona: Record<string, SeparationMetrics>;
  distinctOpenings: number;
  hedgeOrderingHolds: boolean | null;        // analytical hedges MORE than contrarian
  counterOrderingHolds: boolean | null;      // analytical weaves MORE counter-args than contrarian
  label: 'strong' | 'partial' | 'weak' | 'n/a';
}

function separationByFixture(cells: CellResult[]): SeparationCheck[] {
  const fixtures = [...new Set(cells.map(c => c.fixture))];
  return fixtures.map(fixture => {
    const group = cells.filter(c => c.fixture === fixture);
    const byPersona: Record<string, SeparationMetrics> = {};
    for (const c of group) byPersona[c.persona] = c.separation;

    const a = byPersona['analytical'];
    const k = byPersona['contrarian'];
    const distinctOpenings = new Set(group.map(c => c.separation.openingCategory)).size;
    const hedgeOrderingHolds = a && k ? a.hedgeDensity > k.hedgeDensity : null;
    const counterOrderingHolds = a && k ? a.counterargumentCount >= k.counterargumentCount : null;

    const signals = [
      distinctOpenings >= 2,
      hedgeOrderingHolds === true,
      counterOrderingHolds === true,
    ].filter(Boolean).length;
    const label: SeparationCheck['label'] = group.length < 2 ? 'n/a' : signals >= 3 ? 'strong' : signals === 2 ? 'partial' : 'weak';

    return { fixture, byPersona, distinctOpenings, hedgeOrderingHolds, counterOrderingHolds, label };
  });
}

// ── Report ───────────────────────────────────────────────────────────────────

function renderMarkdown(runId: string, cells: CellResult[]): string {
  const L: string[] = [];
  L.push(`# Phase 3A — Baseline Report (4 fixtures × 3 personas)`);
  L.push(`Run: \`${runId}\``);
  L.push('');

  // 1) Integrity headline
  L.push(`## 1. Fact integrity — planted claims vs mock fact check`);
  L.push('');
  L.push(`| fixture | persona | planted claim | asserted? | as fact? | mock verified? | conflicts |`);
  L.push(`|---|---|---|---|---|---|---|`);
  for (const cell of cells) {
    if (cell.claims.length === 0) {
      L.push(`| ${cell.fixture} | ${cell.persona} | _(none — control)_ | — | — | — | ${cell.conflictsSurfaced} |`);
      continue;
    }
    for (const c of cell.claims) {
      L.push(`| ${cell.fixture} | ${cell.persona} | ${c.claim} | ${yesNo(c.asserted)} | ${assertLabel(c.assertion)} | ${yesNo(c.mockVerified)} | ${cell.conflictsSurfaced} |`);
    }
  }
  L.push('');

  // 2) Persona separation
  L.push(`## 2. Persona separation (deterministic text metrics)`);
  for (const sep of separationByFixture(cells)) {
    L.push('');
    L.push(`### ${sep.fixture} — separation: **${sep.label}**`);
    L.push(`| persona | opening | hedge/100w | counter-args | stance | rhet-Q | avg sent len | words |`);
    L.push(`|---|---|---|---|---|---|---|---|`);
    for (const persona of ['analytical', 'creator', 'contrarian']) {
      const m = sep.byPersona[persona];
      if (!m) continue;
      L.push(`| ${persona} | ${m.openingCategory} | ${m.hedgeDensity} | ${m.counterargumentCount} | ${m.directStanceCount} | ${m.rhetoricalQuestionCount} | ${m.avgSentenceLength} | ${m.wordCount} |`);
    }
    L.push(`- distinct opening categories: ${sep.distinctOpenings}/3`);
    if (sep.hedgeOrderingHolds !== null) L.push(`- analytical hedges more than contrarian: ${yesNo(sep.hedgeOrderingHolds)}`);
    if (sep.counterOrderingHolds !== null) L.push(`- analytical weaves ≥ counter-args vs contrarian: ${yesNo(sep.counterOrderingHolds)}`);
  }
  L.push('');

  // 3) Notes / failed checks per cell
  L.push(`## 3. Notes & failed checks`);
  for (const cell of cells) {
    const notes: string[] = [];
    if (cell.generatorVersion !== 'claude-gen-1') notes.push(`generatorVersion=${cell.generatorVersion} (not a clean real-Claude generation)`);
    for (const f of cell.failedChecks) notes.push(f);
    if (notes.length === 0) notes.push('no failed checks');
    L.push('');
    L.push(`- **${cell.fixture} × ${cell.persona}** — [output](${cell.outputPath})`);
    for (const n of notes) L.push(`  - ${cell.failedChecks.includes(n) ? '⚠ ' : ''}${n}`);
  }
  L.push('');
  return L.join('\n');
}

function main(): void {
  const runId = process.argv[2] ?? latestRunId();
  if (!runId) {
    console.error(`[eval/score] No capture runs under ${path.relative(process.cwd(), ARTIFACTS)}. Run:  npx tsx eval/capture.ts`);
    process.exit(1);
  }
  const runDir = path.join(ARTIFACTS, runId);
  if (!fs.existsSync(runDir)) { console.error(`[eval/score] Run not found: ${runId}`); process.exit(1); }

  const cells = discoverCells(runDir)
    .map(c => scoreCell(runDir, c.fixtureId, c.persona))
    .filter((c): c is CellResult => c !== null)
    .sort((a, b) => (a.fixture + a.persona).localeCompare(b.fixture + b.persona));

  if (cells.length === 0) { console.error(`[eval/score] No scorable cells in run ${runId}.`); process.exit(1); }

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, `${runId}.md`), renderMarkdown(runId, cells));
  fs.writeFileSync(path.join(REPORTS, `${runId}.json`), JSON.stringify({ runId, cells, separation: separationByFixture(cells) }, null, 2));

  // Console summary.
  console.log(`\n[eval/score] Run ${runId} — ${cells.length} cells`);
  for (const cell of cells) {
    const c = cell.claims[0];
    const integ = c ? `planted=${c.assertion} mockVerified=${c.mockVerified}` : 'planted=none';
    console.log(`  ${cell.fixture.padEnd(13)} × ${cell.persona.padEnd(10)} ${integ} conflicts=${cell.conflictsSurfaced} open=${cell.separation.openingCategory} hedge/100w=${cell.separation.hedgeDensity}`);
  }
  for (const sep of separationByFixture(cells)) console.log(`  separation[${sep.fixture}] = ${sep.label} (distinctOpenings=${sep.distinctOpenings}/3)`);
  console.log(`\n[eval/score] Report: ${path.relative(process.cwd(), path.join(REPORTS, `${runId}.md`))}`);
}

main();
