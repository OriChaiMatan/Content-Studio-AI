import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { contentGenerationConfig, researchSynthesisConfig } from '../src/lib/anthropic';
import { researchSynthesisService } from '../src/services/researchSynthesisService';
import { generateFactCheckReport } from '../src/services/mockAiService';
import { buildGeneratorInput } from '../src/services/generatorInput';
import { contentGeneratorService } from '../src/services/contentGeneratorService';
import { engineSystem, renderContext } from '../src/prompts/engine.system';
import { PLATFORM_SPECS } from '../src/prompts/platforms';
import type { ContentPlatform } from '../src/schemas/aiContractSchemas';
import type { ContentCase } from '@prisma/client';

import { makeCase, makeSource, makeRun } from './factories';
import { ALL_FIXTURES } from './fixtures';
import type { EvalFixture, Persona } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3A — CAPTURE (real Claude). Drives the REAL generation services over a
// fabricated, in-memory case/source/run (no DB) and writes artifacts to disk.
// Scoring is a separate, Claude-free step (score.ts).
//
// Scope: one high-value cell — adversarial × contrarian. The matrix is config at
// the top (FIXTURES / PERSONAS); research runs ONCE per fixture (persona-
// independent) and is reused, so personas differ only by voice.
//
// Run:  npx tsx eval/capture.ts
// ─────────────────────────────────────────────────────────────────────────────

// Matrix config — full Phase 3A baseline: 4 fixtures × 3 personas.
// Narrow these (e.g. a single fixture/persona) for a quick targeted re-capture.
const FIXTURES: EvalFixture[] = ALL_FIXTURES;
const PERSONAS: Persona[] = ['analytical', 'creator', 'contrarian'];

type ContentCaseGoal = ContentCase['contentGoal'];
type ContentCaseStyle = ContentCase['contentStyle'];

const PERSONA_CASE: Record<Persona, { contentStyle: string; contentGoal: string }> = {
  analytical: { contentStyle: 'professional', contentGoal: 'build_authority' },
  creator:    { contentStyle: 'friendly',     contentGoal: 'grow_community' },
  contrarian: { contentStyle: 'provocative',  contentGoal: 'build_authority' },
};

function assertRealPath(): void {
  const problems: string[] = [];
  if (!researchSynthesisConfig.enabled) problems.push('RESEARCH_SYNTHESIS_ENABLED must be "true"');
  if (!contentGenerationConfig.enabled) problems.push('CONTENT_GENERATION_ENABLED must be "true"');
  if (!process.env.ANTHROPIC_API_KEY)   problems.push('ANTHROPIC_API_KEY must be set');
  if (problems.length > 0) {
    console.error(
      '\n[eval/capture] REFUSING TO RUN ON THE MOCK PATH.\n' +
      'The harness must evaluate the real generator; otherwise voiceProfile is ignored\n' +
      'and the fact-check gap cannot be demonstrated. Fix:\n - ' + problems.join('\n - ') + '\n',
    );
    process.exit(1);
  }
}

function gitSha(): string {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; }
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  assertRealPath();

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.resolve(__dirname, 'artifacts', runId);
  fs.mkdirSync(runDir, { recursive: true });

  const manifest = {
    runId,
    startedAt:        new Date().toISOString(),
    gitSha:           gitSha(),
    researchModel:    researchSynthesisConfig.model,
    contentModel:     contentGenerationConfig.model,
    flags: {
      RESEARCH_SYNTHESIS_ENABLED: researchSynthesisConfig.enabled,
      CONTENT_GENERATION_ENABLED: contentGenerationConfig.enabled,
    },
    cells: [] as { fixture: string; persona: Persona; platform: string; researchDegraded: boolean; generatorVersion: string }[],
  };

  for (const fixture of FIXTURES) {
    const platform = fixture.caseBase.contentTargets[0] as ContentPlatform;
    const lang = fixture.caseBase.language;

    // ── Base case + sources + run (shared across personas) ───────────────────
    const baseCase = makeCase({
      title:       fixture.caseBase.title,
      language:    lang,
      contentGoal: fixture.caseBase.contentGoal as ContentCaseGoal,
      contentStyle:'professional',
      contentTargets: fixture.caseBase.contentTargets,
    });
    const sources = fixture.sources.map((s, i) => makeSource(baseCase.id, s, i));
    const run = makeRun(baseCase.id, sources.map(s => s.id), lang);

    const fixtureDir = path.resolve(runDir, fixture.id);
    fs.mkdirSync(fixtureDir, { recursive: true });

    // ── Research ONCE (persona-independent) ──────────────────────────────────
    console.log(`[eval/capture] ${fixture.id}: research synthesis…`);
    const research = await researchSynthesisService.synthesize({
      run, caseItem: baseCase, primarySources: sources, contextSources: [],
    });
    const researchDegraded = Boolean((research as { meta?: { degraded?: boolean } }).meta?.degraded);
    if (researchDegraded) console.warn(`[eval/capture] ${fixture.id}: research DEGRADED (mock fallback) — results reflect the mock path.`);
    run.researchContext = research as unknown as typeof run.researchContext;
    writeJson(path.resolve(fixtureDir, 'research.json'), research);

    // ── Mock fact check ONCE ─────────────────────────────────────────────────
    const factCheck = generateFactCheckReport(run, research, sources, []);
    run.factCheckReport = factCheck as unknown as typeof run.factCheckReport;
    writeJson(path.resolve(fixtureDir, 'factcheck.json'), factCheck);

    // ── Generation per persona ───────────────────────────────────────────────
    for (const persona of PERSONAS) {
      const pc = PERSONA_CASE[persona];
      const personaCase = makeCase({
        ...baseCase,
        contentStyle: pc.contentStyle as ContentCaseStyle,
        contentGoal:  pc.contentGoal as ContentCaseGoal,
      });

      // Capture the exact prompt + resolved voiceProfile (buildGeneratorInput is
      // pure; generateAll re-derives the same input internally).
      const gi = buildGeneratorInput(platform, run, personaCase, sources);
      const systemPrompt = `${engineSystem(gi.contract.outputLanguage)}\n\n${PLATFORM_SPECS[platform].instruction}`;
      const userPrompt = renderContext(gi);

      console.log(`[eval/capture] ${fixture.id} × ${persona}: generating (${platform})…`);
      const outputs = await contentGeneratorService.generateAll([platform], run, personaCase, sources);
      const output = outputs[0];
      const generatorVersion = String((output?.metadata as { generatorVersion?: string })?.generatorVersion ?? 'unknown');
      const degraded = Boolean((output?.metadata as { degraded?: boolean })?.degraded);
      if (degraded) console.warn(`[eval/capture] ${fixture.id} × ${persona}: content DEGRADED (mock fallback) — generatorVersion=${generatorVersion}.`);

      const cellDir = path.resolve(runDir, `${fixture.id}__${persona}`);
      fs.mkdirSync(cellDir, { recursive: true });
      writeJson(path.resolve(cellDir, 'output.json'), output);
      fs.writeFileSync(path.resolve(cellDir, 'output.md'), output?.readyToPublish ?? '(no output)');
      writeJson(path.resolve(cellDir, 'voiceProfile.json'), gi.voiceProfile ?? null);
      fs.writeFileSync(path.resolve(cellDir, 'prompt.system.txt'), systemPrompt);
      fs.writeFileSync(path.resolve(cellDir, 'prompt.user.txt'), userPrompt);

      manifest.cells.push({ fixture: fixture.id, persona, platform, researchDegraded, generatorVersion });
    }
  }

  writeJson(path.resolve(runDir, 'manifest.json'), { ...manifest, finishedAt: new Date().toISOString() });
  console.log(`\n[eval/capture] done. Artifacts: ${path.relative(process.cwd(), runDir)}`);
  console.log(`[eval/capture] score with:  npx tsx eval/score.ts`);
}

main().catch(err => {
  console.error('[eval/capture] FATAL', err);
  process.exit(1);
});
