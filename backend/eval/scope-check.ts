import 'dotenv/config';
import { researchSynthesisConfig, contentGenerationConfig } from '../src/lib/anthropic';
import { researchSynthesisService } from '../src/services/researchSynthesisService';
import { factCheckService } from '../src/services/factCheckService';
import { contentGeneratorService } from '../src/services/contentGeneratorService';
import type { ContentPlatform } from '../src/schemas/aiContractSchemas';
import { makeCase, makeSource, makeRun } from './factories';
import { trulyIncoherentMultiFixture as fx } from './fixtures/trulyIncoherentMulti';

// Phase 4A.2 end-to-end check: research drops 3 of 4 cross-domain sources; the
// generator must focus on the winning cluster and NOT re-blend the dropped themes.
// Run:  npx tsx eval/scope-check.ts   (uses contrarian voice — most likely to roam)

// Per-source domain keyword sets (index aligns with fixture.sources order).
const DOMAIN_KEYWORDS: string[][] = [
  ['brightpay', 'ipo', 'lending', 'payments', '$900', 'debut'],                 // 0 fintech
  ['wheat', 'rainfall', 'yield', 'agricultur', 'food security', 'climate'],      // 1 climate
  ['soccer', 'streaming rights', 'broadcast', 'league', '$2.1', 'subscription'], // 2 sports
  ['fermented', 'chili', 'recipe', 'condiment', 'gut'],                          // 3 food
];
const DOMAIN_NAME = ['fintech', 'climate', 'sports', 'food'];

async function main(): Promise<void> {
  if (!researchSynthesisConfig.enabled || !contentGenerationConfig.enabled || !process.env.ANTHROPIC_API_KEY) {
    console.error('[scope-check] needs RESEARCH_SYNTHESIS_ENABLED=true, CONTENT_GENERATION_ENABLED=true, and ANTHROPIC_API_KEY.');
    process.exit(1);
  }
  const caseItem = makeCase({ title: fx.caseBase.title, contentGoal: 'build_authority', contentStyle: 'provocative' });
  const sources = fx.sources.map((s, i) => makeSource(caseItem.id, s, i));
  const run = makeRun(caseItem.id, sources.map(s => s.id), 'en');

  console.log('[scope-check] research synthesis…');
  const research = await researchSynthesisService.synthesize({ run, caseItem, primarySources: sources, contextSources: [] });
  run.researchContext = research as unknown as typeof run.researchContext;
  console.log('[scope-check] fact check…');
  const fc = await factCheckService.generateReport({ run, researchContext: research, primarySources: sources, contextSources: [] });
  run.factCheckReport = fc as unknown as typeof run.factCheckReport;

  console.log('[scope-check] generating (facebook, contrarian)…');
  const outputs = await contentGeneratorService.generateAll(['facebook' as ContentPlatform], run, caseItem, sources);
  const text = (outputs[0]?.readyToPublish ?? '').toLowerCase();

  const coherence = (research as any).meta?.coherence;
  const inScopeRefs: string[] = (research as any).synthesis?.primaryAngle?.synthesisBasis?.sourceRefs ?? [];
  const inScopeIdx = new Set(inScopeRefs.map(r => parseInt(r.replace(/\D/g, ''), 10) - 1));
  const generatorVersion = (outputs[0]?.metadata as any)?.generatorVersion;

  console.log(`\ncoherence: score=${coherence?.score} label=${coherence?.label} risk=${coherence?.forcedSynthesisRisk}`);
  console.log(`in-scope refs: ${JSON.stringify(inScopeRefs)} → domains: ${[...inScopeIdx].map(i => DOMAIN_NAME[i]).join(', ') || '(none)'}`);
  console.log(`winner thesis: ${(research as any).synthesis?.primaryAngle?.thesis}`);
  console.log(`generatorVersion: ${generatorVersion}`);

  let leaked = false;
  console.log('\n--- out-of-scope leak check ---');
  for (let i = 0; i < DOMAIN_KEYWORDS.length; i++) {
    if (inScopeIdx.has(i)) continue;
    const hits = DOMAIN_KEYWORDS[i].filter(k => text.includes(k));
    if (hits.length) { leaked = true; console.log(`  ❌ ${DOMAIN_NAME[i]} LEAKED: ${JSON.stringify(hits)}`); }
    else console.log(`  ✅ ${DOMAIN_NAME[i]} excluded`);
  }
  const inScopePresent = [...inScopeIdx].some(i => DOMAIN_KEYWORDS[i].some(k => text.includes(k)));
  console.log(`\nin-scope theme present in output: ${inScopePresent ? 'yes ✅' : 'no ⚠'}`);
  console.log(`\nRESULT: ${!leaked && coherence?.label && coherence.label !== 'coherent' ? 'PASS ✅ (dropped sources excluded)' : leaked ? 'FAIL ❌ (leak)' : 'INCONCLUSIVE (coherence not low this run)'}`);
  console.log('\n--- output ---\n' + (outputs[0]?.readyToPublish ?? '(none)'));
}

main().catch(e => { console.error('[scope-check] FATAL', e); process.exit(1); });
