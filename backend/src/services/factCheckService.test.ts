import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleReport, degradedReport } from './factCheckService';
import { FactCheckReportSchema } from '../schemas/aiContractSchemas';

// Phase 3B — deterministic tests for the pure fact-check assembly + fail-closed
// degradation. No Claude. Covers: supported, vendor projection, contradiction,
// unsupported, and failure-closed.

const ctx = {
  runId: 'run-1', caseId: 'case-1',
  sourceLabels: ['Source A', 'Source B'],
  claimsToCheck: ['Claim A', 'Claim B', 'Claim B'],   // dup on purpose
};

const raw = (claims: unknown[], extra: Record<string, unknown> = {}) => ({
  claims, crossSourceContradictions: [], editorialWarnings: [], ...extra,
});

test('A. supported + cited → verified, high integrity, low risk', () => {
  const r = assembleReport(raw([
    { claim: 'X shipped a product', classification: 'supported', confidence: 95, sourceRefs: ['S1'], selfOrVendorReported: false, note: 'stated in S1' },
  ]), ctx);
  assert.equal(r.verifiedClaims.length, 1);
  assert.equal(r.unsupportedClaims.length, 0);
  assert.equal(r.integrityScore, 100);
  assert.equal(r.riskLevel, 'low');
  assert.equal(r.degraded, false);
  assert.ok(FactCheckReportSchema.safeParse(r).success);
});

test('B. vendor projection marked "supported" is DOWNGRADED to uncertain (never verified)', () => {
  const r = assembleReport(raw([
    { claim: 'The system will cut delays by 73%', classification: 'supported', confidence: 80, sourceRefs: ['S1'], selfOrVendorReported: true, note: 'vendor projection' },
  ]), ctx);
  assert.equal(r.verifiedClaims.length, 0);          // success criterion: NOT verified
  assert.equal(r.uncertainClaims.length, 1);
  assert.match(r.uncertainClaims[0].notes, /self\/vendor-reported/);
  assert.ok(FactCheckReportSchema.safeParse(r).success);
});

test('C. cross-source contradiction → conflicting, capped integrity, high risk', () => {
  const r = assembleReport(raw(
    [{ claim: 'A real fact', classification: 'supported', confidence: 90, sourceRefs: ['S1'], selfOrVendorReported: false, note: '' }],
    { crossSourceContradictions: [{ subject: 'metric', claimA: 'up 18%', claimB: 'no validated results', sourceRefs: ['S1', 'S2'] }] },
  ), ctx);
  assert.equal(r.conflictingClaims.length, 1);
  assert.ok(r.integrityScore !== undefined && r.integrityScore <= 55);
  assert.equal(r.riskLevel, 'high');
  assert.ok(FactCheckReportSchema.safeParse(r).success);
});

test('D. unsupported, and supported-without-source-ref downgraded to unsupported', () => {
  const r = assembleReport(raw([
    { claim: 'Invented a $1.2B valuation', classification: 'unsupported', confidence: 40, sourceRefs: [], selfOrVendorReported: false, note: 'not in sources' },
    { claim: 'Asserted supported but cites nothing', classification: 'supported', confidence: 70, sourceRefs: [], selfOrVendorReported: false, note: '' },
  ]), ctx);
  assert.equal(r.verifiedClaims.length, 0);
  assert.equal(r.unsupportedClaims.length, 2);
  assert.equal(r.riskLevel, 'high');
  assert.ok(FactCheckReportSchema.safeParse(r).success);
});

test('E. fail-closed degraded report: nothing verified, all uncertain, low integrity, high risk', () => {
  const r = degradedReport(ctx, 'api_error');
  assert.equal(r.verifiedClaims.length, 0);
  assert.equal(r.conflictingClaims.length, 0);
  assert.equal(r.uncertainClaims.length, 2);          // deduped Claim A + Claim B
  assert.equal(r.integrityScore, 25);
  assert.equal(r.riskLevel, 'high');
  assert.equal(r.degraded, true);
  assert.equal(r.factCheckVersion, 'degraded');
  assert.ok(FactCheckReportSchema.safeParse(r).success);
});
