import 'dotenv/config';
import { factCheckService } from '../src/services/factCheckService';
import type { ResearchContext } from '../src/schemas/aiContractSchemas';
import { makeCase, makeSource, makeRun } from './factories';
import { adversarialFixture } from './fixtures/adversarial';

// Phase 3B validation probe — runs the REAL fact check on the adversarial fixture's
// planted 73% vendor projection and reports which bucket it lands in.
// Run:  REAL_FACT_CHECK_ENABLED=true npx tsx eval/factcheck-probe.ts

async function main(): Promise<void> {
  const caseItem = makeCase({ title: adversarialFixture.caseBase.title });
  const sources = adversarialFixture.sources.map((s, i) => makeSource(caseItem.id, s, i));
  const run = makeRun(caseItem.id, sources.map(s => s.id), 'en');

  const researchContext = {
    caseId: caseItem.id,
    importantClaims: [
      'Northwind has begun rolling out an AI routing system built by RouteIQ across its North American fleet.',
      'RouteIQ projects a 73% reduction in delivery delays within the first year.',
      'Northwind has not released its own performance figures yet.',
    ],
    contradictions: ['Vendor projects a 73% reduction, yet Northwind has released no validated results.'],
  } as unknown as ResearchContext;

  const report = await factCheckService.generateReport({ run, researchContext, primarySources: sources, contextSources: [] });

  const inBucket = (arr: { claim: string }[]) => arr.filter(c => /73%/.test(c.claim)).map(c => c.claim);
  console.log('factCheckVersion:', report.factCheckVersion, '| integrity:', report.integrityScore, '| risk:', report.riskLevel, '| degraded:', report.degraded);
  console.log('73% → verified   :', inBucket(report.verifiedClaims));
  console.log('73% → uncertain  :', inBucket(report.uncertainClaims));
  console.log('73% → unsupported:', inBucket(report.unsupportedClaims));
  console.log('73% → conflicting:', inBucket(report.conflictingClaims));
  console.log('conflicts total  :', report.conflictingClaims.length);
  console.log('editorialWarnings:', report.editorialWarnings);

  const verified73 = inBucket(report.verifiedClaims).length > 0;
  console.log(`\nSUCCESS CRITERION (73% NOT verified): ${verified73 ? 'FAIL ❌' : 'PASS ✅'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
