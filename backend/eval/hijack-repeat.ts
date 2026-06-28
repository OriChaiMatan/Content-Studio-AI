import 'dotenv/config';
import { researchSynthesisConfig } from '../src/lib/anthropic';
import { researchSynthesisService } from '../src/services/researchSynthesisService';
import { makeCase, makeSource, makeRun } from './factories';
import { dominantClusterWithOutlierFixture as fx } from './fixtures/dominantClusterWithOutlier';
import type { ContentCase } from '@prisma/client';

// Outlier-hijack frequency probe (eval-only): run research synthesis on the
// surfing(S1–S4) + AI(S5) fixture N times and measure how often S5 hijacks the
// thesis. No production code / prompt / scoring change.
// Run:  RESEARCH_SYNTHESIS_ENABLED=true npx tsx eval/hijack-repeat.ts

const N = 5;
const AI_MARKERS = ['בינה מלאכותית', 'אינטליגנציה מלאכותית', ' ai', 'ai ', 'בינה', 'מלאכותית'];

interface RunResult {
  run: number;
  score: number | null;
  label: string;
  risk: string;
  themes: { theme: string; refs: string[] }[];
  outlierRefs: string[];
  s5Outlier: boolean;
  thesis: string;
  winnerRefs: string[];
  winnerKind: string;
  outlierAnchored: boolean;
  aiInThesis: boolean;
  gateFired: boolean;
  hijack: boolean;
}

function analyze(run: number, rc: any): RunResult {
  const meta = rc.meta ?? {};
  const coh = meta.coherence ?? {};
  const pa = rc.synthesis?.primaryAngle ?? {};
  const themes = (Array.isArray(coh.dominantThemes) ? coh.dominantThemes : []).map((t: any) => ({ theme: String(t?.theme ?? '').slice(0, 60), refs: t?.sourceRefs ?? [] }));
  const outlierRefs: string[] = Array.isArray(coh.outlierSourceRefs) ? coh.outlierSourceRefs : [];
  const winnerRefs: string[] = pa?.synthesisBasis?.sourceRefs ?? [];
  const thesis = String(pa?.thesis ?? '');
  const topTheme = [...themes].sort((a, b) => b.refs.length - a.refs.length)[0];
  const topSet = new Set<string>(topTheme?.refs ?? []);
  const score = typeof coh.score === 'number' ? coh.score : null;

  const s5Outlier = outlierRefs.includes('S5');
  const aiInThesis = AI_MARKERS.some(m => thesis.toLowerCase().includes(m));
  const outlierAnchored = winnerRefs.includes('S5') || (topSet.size > 0 && winnerRefs.some(r => !topSet.has(r)));
  const gateFired = score !== null && score < 55 && !meta.singleSource;
  const hijack = winnerRefs.includes('S5') || aiInThesis;

  return {
    run, score, label: coh.label ?? '(none)', risk: coh.forcedSynthesisRisk ?? '(none)',
    themes, outlierRefs, s5Outlier, thesis: thesis.slice(0, 120), winnerRefs,
    winnerKind: rc.synthesis?.thesisCompetition?.candidates?.[rc.synthesis?.thesisCompetition?.winnerIndex ?? 0]?.connectionKind ?? '(none)',
    outlierAnchored, aiInThesis, gateFired, hijack,
  };
}

async function main(): Promise<void> {
  if (!researchSynthesisConfig.enabled || !process.env.ANTHROPIC_API_KEY) {
    console.error('[hijack-repeat] needs RESEARCH_SYNTHESIS_ENABLED=true and ANTHROPIC_API_KEY.');
    process.exit(1);
  }
  const results: RunResult[] = [];
  for (let i = 1; i <= N; i++) {
    const caseItem = makeCase({ title: fx.caseBase.title, contentGoal: 'build_authority', language: fx.caseBase.language as ContentCase['language'] });
    const sources = fx.sources.map((s, idx) => makeSource(caseItem.id, s, idx));
    const run = makeRun(caseItem.id, sources.map(s => s.id), fx.caseBase.language);
    console.log(`[hijack-repeat] run ${i}/${N}: synthesizing…`);
    const rc = await researchSynthesisService.synthesize({ run, caseItem, primarySources: sources, contextSources: [] });
    const r = analyze(i, rc as any);
    if ((rc as any).meta?.degraded) console.warn(`  run ${i}: DEGRADED (mock fallback)`);
    results.push(r);
    console.log(`  run ${i}: score=${r.score} label=${r.label} risk=${r.risk} s5Outlier=${r.s5Outlier} gateFired=${r.gateFired} winnerRefs=${JSON.stringify(r.winnerRefs)} kind=${r.winnerKind} HIJACK=${r.hijack}`);
    console.log(`    themes=${r.themes.map(t => `{${t.refs.join(',')}}`).join(' ')} outliers=${JSON.stringify(r.outlierRefs)}`);
    console.log(`    thesis: ${r.thesis}`);
  }

  const n = results.length;
  const hijacks = results.filter(r => r.hijack).length;
  const s5Detected = results.filter(r => r.s5Outlier).length;
  const gateFired = results.filter(r => r.gateFired).length;
  const aiInThesis = results.filter(r => r.aiInThesis).length;
  const outlierAnchored = results.filter(r => r.outlierAnchored).length;

  console.log('\n=== SUMMARY (N=' + n + ') ===');
  console.log(`hijack frequency:           ${hijacks}/${n}  (winner uses S5 OR AI in thesis)`);
  console.log(`  - AI in winning thesis:   ${aiInThesis}/${n}`);
  console.log(`  - winner outlier-anchored:${outlierAnchored}/${n}`);
  console.log(`S5 detected as outlier:     ${s5Detected}/${n}`);
  console.log(`gate fired (score<55):      ${gateFired}/${n}`);
  console.log(`scores: ${results.map(r => r.score).join(', ')}`);
  console.log(`labels: ${results.map(r => r.label).join(', ')}`);
}

main().catch(e => { console.error('[hijack-repeat] FATAL', e); process.exit(1); });
