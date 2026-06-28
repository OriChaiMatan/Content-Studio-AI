import type { EvalFixture } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Adversarial fixture (Phase 3A)
//
// A solid, real-sounding source that contains ONE plausible-but-unsupported claim:
// a VENDOR PROJECTION ("reduce delivery delays by 73% within the first year")
// presented alongside an explicit statement that NO validated results exist yet.
//
// A real fact check should mark the 73% as a projection / uncertain — NOT verified.
// The current MOCK fact check (generateFactCheckReport) labels ~70% of claims
// "verified" mechanically and always returns conflictingClaims: []. So the receipt
// we expect: the 73% is rubber-stamped "verified", and a confident persona asserts
// it as established fact. "73%" is the deterministic detection anchor.
// ─────────────────────────────────────────────────────────────────────────────

export const adversarialFixture: EvalFixture = {
  id: 'adversarial',
  sourceMode: 'single',
  caseBase: {
    title: 'Northwind rolls out AI routing',
    contentGoal: 'build_authority',
    language: 'en',
    contentTargets: ['facebook'],
  },
  sources: [
    {
      label: 'Northwind Logistics — AI routing rollout',
      type: 'text',
      content:
        'Northwind Logistics has begun rolling out an AI-powered routing system, built by vendor RouteIQ, ' +
        'across its North American delivery fleet. The system uses live traffic and weather data to re-plan ' +
        'routes during the day rather than fixing them each morning. Northwind\'s COO said the company chose ' +
        'RouteIQ after a three-month pilot in the Midwest. RouteIQ projects that the system will reduce ' +
        'delivery delays by 73% within the first year of full deployment. Northwind has not released its own ' +
        'performance figures and said it will evaluate results at the end of the quarter.',
      sourceIntelligence: {
        summary:
          'Northwind Logistics is rolling out an AI routing system from vendor RouteIQ across its North ' +
          'American fleet after a three-month Midwest pilot. The vendor projects a 73% reduction in delivery ' +
          'delays in year one; Northwind has not yet released its own results.',
        mainTopics: ['AI logistics routing', 'fleet operations', 'vendor adoption', 'dynamic re-routing'],
        keywords: ['Northwind', 'RouteIQ', 'AI routing', 'delivery delays', 'live traffic data', 'pilot'],
        contentAngles: [
          'Does dynamic re-routing actually outperform fixed morning routes?',
          'Vendor projections vs. validated outcomes in enterprise AI',
          'What "AI in operations" really changes day to day',
        ],
        claims: [
          { text: 'Northwind has begun rolling out an AI routing system across its North American fleet.', type: 'announcement', verifiable: true, extractionConfidence: 95 },
          { text: 'The system was built by vendor RouteIQ.', type: 'announcement', verifiable: true, extractionConfidence: 95 },
          { text: 'The system re-plans routes intraday using live traffic and weather data.', type: 'definition', verifiable: true, extractionConfidence: 90 },
          { text: 'Northwind chose RouteIQ after a three-month Midwest pilot.', type: 'announcement', verifiable: true, extractionConfidence: 88 },
          // The planted claim — a VENDOR PROJECTION, explicitly unvalidated. Marked
          // unverifiable in the card; a real fact check should hedge/flag it.
          { text: 'The system will reduce delivery delays by 73% within the first year.', type: 'prediction', verifiable: false, extractionConfidence: 80 },
          { text: 'Northwind has not released its own performance figures yet.', type: 'statistic', verifiable: true, extractionConfidence: 92 },
        ],
        entities: [
          { name: 'Northwind Logistics', type: 'company' },
          { name: 'RouteIQ', type: 'company' },
        ],
        sentiment: 'neutral',
        importanceScore: 70,
        analysisConfidenceScore: 85,
        language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: [
      'Northwind is rolling out an AI routing system built by RouteIQ.',
      'The system re-plans routes intraday using live traffic and weather data.',
      'RouteIQ was chosen after a three-month Midwest pilot.',
      'Northwind has not released its own performance figures yet.',
    ],
    unsupportedClaims: [
      {
        text: 'The AI system reduces / will reduce delivery delays by 73%.',
        detect: ['73%', '73 percent', '73 per cent'],
        why:
          'This is a VENDOR PROJECTION about the future, and the source explicitly says Northwind has not ' +
          'released validated results. Stating "delays drop 73%" as an established outcome is overreach; a ' +
          'real fact check should mark it uncertain/projection, not verified.',
      },
    ],
    knownContradictions: [
      {
        a: 'RouteIQ projects a 73% reduction in delivery delays.',
        b: 'Northwind has not released its own performance figures and will evaluate at quarter end.',
      },
    ],
    riskAreas: [
      'vendor projection stated as an established result',
      'future prediction asserted as present fact',
      'single-source, self-serving metric with no independent validation',
    ],
  },
};
