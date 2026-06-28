import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCoherence, buildCompetition } from './research';
import type { ThesisScores, EditorialScores } from '../schemas/aiContractSchemas';

// Phase 4A — coherence score derivation + coherence-gated thesis selection.
// Pure/deterministic; no Claude.

const refMap = (n: number) => Array.from({ length: n }, (_, i) => ({ ref: `S${i + 1}`, sourceId: `id${i + 1}`, label: `L${i + 1}`, role: 'primary' as const }));
const meta = (n: number, single = false) => ({ sourceCount: n, primarySourceCount: n, contextSourceCount: 0, synthesisConfidence: 70, singleSource: single, generatorVersion: 'research-1', degraded: false, sourceRefMap: refMap(n) }) as any;
const synth = (overrides: any = {}) => ({ mainStory: { headline: 'H', summary: 'A summary long enough', sourceRefs: ['S1', 'S2'] }, supportingStories: [], sourceConnections: [], tensions: [], contradictions: [], secondOrderImplications: [], nonObviousInsights: [], openQuestions: [], ...overrides }) as any;
const knowledge = { coreSubjects: [], keyFacts: [{ statement: 'fact', type: 'claim', sourceRefs: ['S1'], grounding: 'stated', status: 'claimed', confidence: 80 }] } as any;

const scores = (v: number, cov = v): ThesisScores => ({ novelty: v, explanatoryPower: v, crossSourceCoverage: cov, discussionPotential: v, businessValue: v, strategicDepth: v });
const ed = (v = 7): EditorialScores => ({ readerCuriosity: v, reframeStrength: v, narrativeTension: v, headlinePower: v });
const cand = (o: Partial<any>) => ({ thesis: 'T', reframe: 'R', basisKind: 'connection', grounding: 'inferred', sourceRefs: ['S1', 'S2'], rationale: 'why', qualifyingProperties: ['hidden-driver'], connectionKind: 'single_mechanism', scores: scores(6), editorialScores: ed(), ...o });

// ── computeCoherence ─────────────────────────────────────────────────────────

test('coherence: one dominant theme covering all sources → high / coherent', () => {
  const raw = { coherenceAssessment: { dominantThemes: [{ theme: 'one thread', sourceRefs: ['S1', 'S2', 'S3', 'S4'] }], outlierSourceRefs: [], forcedSynthesisRisk: 'low', rationale: 'shared thread' } };
  const c = computeCoherence(raw, synth({ sourceConnections: [{ description: 'd', sourceRefs: ['S1', 'S2'], type: 'causal', novelty: 60, confidence: 80, grounding: 'supported' }] }), meta(4), []);
  assert.ok(c.score >= 75, `score ${c.score}`);
  assert.equal(c.label, 'coherent');
  assert.equal(c.forcedSynthesisRisk, 'low');
});

test('coherence: many themes + outliers + roundup cands → low / multi-topic, high risk', () => {
  const raw = { coherenceAssessment: { dominantThemes: [{ theme: 'ads', sourceRefs: ['S1'] }, { theme: 'hardware', sourceRefs: ['S2'] }, { theme: 'chips', sourceRefs: ['S3'] }], outlierSourceRefs: ['S4'], forcedSynthesisRisk: 'high', rationale: 'separate stories' } };
  const cands = [{ connectionKind: 'grouping_roundup' }] as any;
  const c = computeCoherence(raw, synth({ sourceConnections: [{ description: 'd', sourceRefs: ['S1', 'S2'], type: 'convergent', novelty: 50, confidence: 50, grounding: 'speculative' }] }), meta(4), cands);
  assert.ok(c.score < 55, `score ${c.score}`);
  assert.ok(c.label === 'low' || c.label === 'multi-topic');
  assert.equal(c.forcedSynthesisRisk, 'high');
});

test('coherence: Claude high-risk is a one-way cap even if structure looks ok', () => {
  const raw = { coherenceAssessment: { dominantThemes: [{ theme: 'one', sourceRefs: ['S1', 'S2', 'S3', 'S4'] }], outlierSourceRefs: [], forcedSynthesisRisk: 'high', rationale: 'forced' } };
  const c = computeCoherence(raw, synth(), meta(4), []);
  assert.ok(c.score <= 45, `score ${c.score}`);
});

test('coherence: single source is exempt (trivially coherent)', () => {
  const c = computeCoherence({}, synth(), meta(1, true), []);
  assert.equal(c.score, 100);
  assert.equal(c.label, 'coherent');
});

// ── coherence-gated selection ─────────────────────────────────────────────────

const lowCoherenceRaw = { dominantThemes: [{ theme: 'a', sourceRefs: ['S1'] }, { theme: 'b', sourceRefs: ['S2'] }, { theme: 'c', sourceRefs: ['S3'] }], outlierSourceRefs: ['S4'], forcedSynthesisRisk: 'high', rationale: 'unrelated' };
const highCoherenceRaw = { dominantThemes: [{ theme: 'one', sourceRefs: ['S1', 'S2', 'S3', 'S4'] }], outlierSourceRefs: [], forcedSynthesisRisk: 'low', rationale: 'shared' };

const roundup = cand({ thesis: 'ROUNDUP everything', sourceRefs: ['S1', 'S2', 'S3', 'S4'], qualifyingProperties: ['explains-unrelated'], connectionKind: 'grouping_roundup', grounding: 'inferred', scores: scores(8, 10), editorialScores: ed(8) });
const cluster = cand({ thesis: 'SHARP single cluster', sourceRefs: ['S1', 'S2'], qualifyingProperties: ['hidden-driver'], connectionKind: 'single_cluster', grounding: 'inferred', scores: scores(6, 6), editorialScores: ed(6) });

test('low coherence: a strong single-cluster thesis beats the all-source roundup', () => {
  const raw = { coherenceAssessment: lowCoherenceRaw, thesisCompetition: { candidateAngles: [roundup, cluster], recommendedWinnerIndex: 0 } };
  const { winnerRaw, coherence } = buildCompetition(raw, synth(), knowledge, meta(4));
  assert.ok(coherence.score < 55, `coherence ${coherence.score}`);
  assert.match(winnerRaw.thesis, /SHARP single cluster/);
});

test('high coherence: the higher-scored genuine cross-source thesis wins and coherence stays high', () => {
  const mechanism = cand({ thesis: 'GENUINE mechanism', sourceRefs: ['S1', 'S2', 'S3', 'S4'], qualifyingProperties: ['hidden-driver'], connectionKind: 'single_mechanism', grounding: 'inferred', scores: scores(8, 9), editorialScores: ed(8) });
  const raw = { coherenceAssessment: highCoherenceRaw, thesisCompetition: { candidateAngles: [mechanism, cluster], recommendedWinnerIndex: 0 } };
  const { winnerRaw, coherence } = buildCompetition(raw, synth(), knowledge, meta(4));
  assert.ok(coherence.score >= 55, `coherence ${coherence.score}`);
  assert.match(winnerRaw.thesis, /GENUINE mechanism/);
});

test('low coherence: a forced_synthesis (abstract tension) loses to a single-cluster thesis', () => {
  const forced = cand({ thesis: 'SPEED vs regulation everything', sourceRefs: ['S1', 'S2', 'S3', 'S4'], qualifyingProperties: ['explains-unrelated'], connectionKind: 'forced_synthesis', grounding: 'inferred', scores: scores(8, 10), editorialScores: ed(8) });
  const raw = { coherenceAssessment: lowCoherenceRaw, thesisCompetition: { candidateAngles: [forced, cluster], recommendedWinnerIndex: 0 } };
  const { winnerRaw } = buildCompetition(raw, synth(), knowledge, meta(4));
  assert.match(winnerRaw.thesis, /SHARP single cluster/);
});

test('low coherence: an abstract productive_tension spanning ALL sources is treated as fake', () => {
  const fakeTension = cand({ thesis: 'SCALE vs trust across all', sourceRefs: ['S1', 'S2', 'S3', 'S4'], qualifyingProperties: ['explains-unrelated'], connectionKind: 'productive_tension', grounding: 'inferred', scores: scores(8, 10), editorialScores: ed(8) });
  const raw = { coherenceAssessment: lowCoherenceRaw, thesisCompetition: { candidateAngles: [fakeTension, cluster], recommendedWinnerIndex: 0 } };
  const { winnerRaw } = buildCompetition(raw, synth(), knowledge, meta(4));
  assert.match(winnerRaw.thesis, /SHARP single cluster/);
});

test('coherence: multi-domain penalty (≥2 themes, no dominant theme, no outliers) drops below the gate', () => {
  const raw = { coherenceAssessment: { dominantThemes: [{ theme: 'a', sourceRefs: ['S1', 'S2'] }, { theme: 'b', sourceRefs: ['S3', 'S4'] }], outlierSourceRefs: [], forcedSynthesisRisk: 'low', rationale: 'two even themes' } };
  const c = computeCoherence(raw, synth({ sourceConnections: [{ description: 'd', sourceRefs: ['S1', 'S2'], type: 'causal', novelty: 60, confidence: 85, grounding: 'supported' }] }), meta(4), []);
  assert.ok(c.score < 55, `score ${c.score}`);   // even with low Claude-risk + supported connection, the spread penalty fires
});

test('low coherence: a grounded single_mechanism hidden-driver is NOT penalized', () => {
  const mechanism = cand({ thesis: 'HIDDEN driver mechanism', sourceRefs: ['S1', 'S2', 'S3'], qualifyingProperties: ['explains-unrelated', 'hidden-driver'], connectionKind: 'single_mechanism', grounding: 'inferred', scores: scores(8, 9), editorialScores: ed(8) });
  const weak = cand({ thesis: 'weak grouping', sourceRefs: ['S1', 'S2', 'S3', 'S4'], qualifyingProperties: ['explains-unrelated'], connectionKind: 'grouping_roundup', grounding: 'inferred', scores: scores(5, 8), editorialScores: ed(5) });
  const raw = { coherenceAssessment: lowCoherenceRaw, thesisCompetition: { candidateAngles: [mechanism, weak], recommendedWinnerIndex: 0 } };
  const { winnerRaw } = buildCompetition(raw, synth(), knowledge, meta(4));
  assert.match(winnerRaw.thesis, /HIDDEN driver mechanism/);
});
