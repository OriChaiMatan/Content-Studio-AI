import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { researchSynthesisConfig } from '../src/lib/anthropic';
import { researchSynthesisService } from '../src/services/researchSynthesisService';
import { makeCase, makeSource, makeRun } from './factories';
import { coherentMultiFixture } from './fixtures/coherentMulti';
import { genuineHiddenDriverFixture } from './fixtures/genuineHiddenDriver';
import { trulyIncoherentMultiFixture } from './fixtures/trulyIncoherentMulti';
import type { EvalFixture } from './types';
import type { ContentCase } from '@prisma/client';

// Coherence-signal validation probe (eval-only). Runs ONLY research synthesis on a
// coherent vs an incoherent multi-source fixture and extracts the persisted signals
// we'd use for a coherence score. No fact check, no generation, no new Claude tool.
// Run:  npx tsx eval/research-probe.ts

const FIXTURES: EvalFixture[] = [coherentMultiFixture, genuineHiddenDriverFixture, trulyIncoherentMultiFixture];

interface Signals {
  fixture: string;
  degraded: boolean;
  sourceCount: number;
  synthesisConfidence: number;
  coherenceScore: number | null;
  coherenceLabel: string;
  forcedSynthesisRisk: string;
  themeCount: number;
  outlierCount: number;
  winnerConnectionKind: string;
  connectionsCount: number;
  connectionsAvgConfidence: number;
  connectionsGrounding: Record<string, number>;
  tensionContradictionCount: number;
  thesis: string;
  winnerCrossSourceCoverage: number | null;
  winnerQualifyingProperties: string[];
  winnerBasisRefs: string[];
  winnerRefFraction: number | null;
  explainsUnrelatedAnyCandidate: boolean;
  hiddenDriverAnyCandidate: boolean;
  candidateCrossCoverageRange: [number, number] | null;
  forcedSynthesisSigns: string[];
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

function extract(fixture: string, rc: Record<string, any>): Signals {
  const meta = rc.meta ?? {};
  const syn = rc.synthesis ?? {};
  const conns: any[] = Array.isArray(syn.sourceConnections) ? syn.sourceConnections : [];
  const comp = syn.thesisCompetition ?? {};
  const cands: any[] = Array.isArray(comp.candidates) ? comp.candidates : [];
  const winner = cands[comp.winnerIndex ?? 0];
  const pa = syn.primaryAngle ?? {};
  const sourceCount = meta.sourceCount ?? 0;

  const grounding: Record<string, number> = {};
  for (const c of conns) grounding[c.grounding ?? 'unknown'] = (grounding[c.grounding ?? 'unknown'] ?? 0) + 1;

  const winnerCov = winner?.scores?.crossSourceCoverage ?? null;
  const winnerQual: string[] = Array.isArray(winner?.qualifyingProperties) ? winner.qualifyingProperties : [];
  const basisRefs: string[] = Array.isArray(pa?.synthesisBasis?.sourceRefs) ? pa.synthesisBasis.sourceRefs : [];
  const covs = cands.map(c => c?.scores?.crossSourceCoverage).filter((n: unknown): n is number => typeof n === 'number');

  const explainsUnrelated = cands.some(c => (c?.qualifyingProperties ?? []).includes('explains-unrelated'));
  const hiddenDriver = cands.some(c => (c?.qualifyingProperties ?? []).includes('hidden-driver'));
  const avgConnConf = mean(conns.map(c => c.confidence ?? 0));

  const forced: string[] = [];
  if (winnerQual.includes('explains-unrelated') && typeof winnerCov === 'number' && winnerCov <= 3) forced.push('winner relies on "explains-unrelated" with low crossSourceCoverage (≤3)');
  if ((grounding['speculative'] ?? 0) > (grounding['supported'] ?? 0)) forced.push('more speculative than supported connections');
  if (avgConnConf < 55 && conns.length > 0) forced.push(`low avg connection confidence (${avgConnConf})`);
  if (typeof winnerCov === 'number' && winnerCov <= 3 && sourceCount >= 3) forced.push('winning thesis barely needs multiple sources (crossSourceCoverage ≤3)');
  if (basisRefs.length > 0 && sourceCount > 0 && basisRefs.length / sourceCount < 0.5) forced.push('winner uses <50% of sources');

  const coh = meta.coherence ?? null;
  return {
    fixture,
    degraded: meta.degraded === true,
    sourceCount,
    synthesisConfidence: meta.synthesisConfidence ?? 0,
    coherenceScore: coh ? coh.score : null,
    coherenceLabel: coh ? coh.label : '(none)',
    forcedSynthesisRisk: coh ? coh.forcedSynthesisRisk : '(none)',
    themeCount: coh && Array.isArray(coh.dominantThemes) ? coh.dominantThemes.length : 0,
    outlierCount: coh && Array.isArray(coh.outlierSourceRefs) ? coh.outlierSourceRefs.length : 0,
    winnerConnectionKind: winner?.connectionKind ?? '(none)',
    connectionsCount: conns.length,
    connectionsAvgConfidence: avgConnConf,
    connectionsGrounding: grounding,
    tensionContradictionCount: (syn.tensions?.length ?? 0) + (syn.contradictions?.length ?? 0),
    thesis: pa?.thesis ?? '(none)',
    winnerCrossSourceCoverage: winnerCov,
    winnerQualifyingProperties: winnerQual,
    winnerBasisRefs: basisRefs,
    winnerRefFraction: sourceCount ? Math.round((basisRefs.length / sourceCount) * 100) / 100 : null,
    explainsUnrelatedAnyCandidate: explainsUnrelated,
    hiddenDriverAnyCandidate: hiddenDriver,
    candidateCrossCoverageRange: covs.length ? [Math.min(...covs), Math.max(...covs)] : null,
    forcedSynthesisSigns: forced,
  };
}

async function main(): Promise<void> {
  if (!researchSynthesisConfig.enabled || !process.env.ANTHROPIC_API_KEY) {
    console.error('[research-probe] needs RESEARCH_SYNTHESIS_ENABLED=true and ANTHROPIC_API_KEY.');
    process.exit(1);
  }
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(__dirname, 'artifacts', `research-probe-${runId}`);
  fs.mkdirSync(dir, { recursive: true });

  const results: Signals[] = [];
  for (const fixture of FIXTURES) {
    const caseItem = makeCase({ title: fixture.caseBase.title, contentGoal: fixture.caseBase.contentGoal as ContentCase['contentGoal'] });
    const sources = fixture.sources.map((s, i) => makeSource(caseItem.id, s, i));
    const run = makeRun(caseItem.id, sources.map(s => s.id), 'en');
    console.log(`[research-probe] ${fixture.id}: synthesizing ${sources.length} sources…`);
    const rc = await researchSynthesisService.synthesize({ run, caseItem, primarySources: sources, contextSources: [] });
    fs.writeFileSync(path.resolve(dir, `${fixture.id}.research.json`), JSON.stringify(rc, null, 2));
    const sig = extract(fixture.id, rc as unknown as Record<string, any>);
    if (sig.degraded) console.warn(`[research-probe] ${fixture.id}: research DEGRADED — signals reflect the mock fallback, not real synthesis.`);
    results.push(sig);
  }

  fs.writeFileSync(path.resolve(dir, 'signals.json'), JSON.stringify(results, null, 2));

  // N-column console table.
  const W = 22;
  const col = (label: string, get: (s: Signals) => unknown) =>
    console.log(`${label.padEnd(30)} | ${results.map(r => String(get(r)).padEnd(W)).join(' | ')}`);
  console.log('\n=== RESEARCH COHERENCE SIGNALS ===');
  col('signal', r => r.fixture.slice(0, W));
  console.log('-'.repeat(34 + results.length * (W + 3)));
  col('coherenceScore (Phase 4A)', r => r.coherenceScore);
  col('coherenceLabel', r => r.coherenceLabel);
  col('forcedSynthesisRisk', r => r.forcedSynthesisRisk);
  col('themeCount', r => r.themeCount);
  col('outlierCount', r => r.outlierCount);
  col('winner connectionKind', r => r.winnerConnectionKind);
  console.log('-'.repeat(34 + results.length * (W + 3)));
  col('synthesisConfidence', r => r.synthesisConfidence);
  col('connections count', r => r.connectionsCount);
  col('connections avg conf', r => r.connectionsAvgConfidence);
  col('connections grounding', r => JSON.stringify(r.connectionsGrounding));
  col('tension+contradiction', r => r.tensionContradictionCount);
  col('winner crossSourceCoverage', r => r.winnerCrossSourceCoverage);
  col('winner ref fraction', r => r.winnerRefFraction);
  col('winner qualifyingProps', r => JSON.stringify(r.winnerQualifyingProperties));
  col('forced-synthesis signs', r => r.forcedSynthesisSigns.length);
  console.log('\n--- theses ---');
  for (const r of results) console.log(`[${r.fixture}] ${r.thesis}`);
  for (const r of results) if (r.forcedSynthesisSigns.length) console.log(`\n[${r.fixture}] forced-synthesis signs:\n  - ${r.forcedSynthesisSigns.join('\n  - ')}`);
  console.log(`\n[research-probe] artifacts: ${path.relative(process.cwd(), dir)}`);
}

main().catch(e => { console.error('[research-probe] FATAL', e); process.exit(1); });
