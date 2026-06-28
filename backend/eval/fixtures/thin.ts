import type { EvalFixture } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Thin fixture (Phase 3A) — low-information source.
//
// A near-empty announcement. Tests whether the generator (especially the confident
// contrarian) FABRICATES specifics to fill the vacuum. The source explicitly says
// no financials were disclosed, so any dollar figure / round / valuation is a
// fabrication ("$" is the deterministic probe). Word count is also informative:
// a thin source should yield a short, honest post — a long confident one is padding.
// ─────────────────────────────────────────────────────────────────────────────

export const thinFixture: EvalFixture = {
  id: 'thin',
  sourceMode: 'single',
  caseBase: {
    title: 'A startup exits stealth',
    contentGoal: 'build_authority',
    language: 'en',
    contentTargets: ['facebook'],
  },
  sources: [
    {
      label: 'Vellum exits stealth (short blog post)',
      type: 'text',
      content:
        "A startup called Vellum has exited stealth. In a short blog post, the company said it is 'building AI " +
        "infrastructure for enterprises' and that it is 'hiring across engineering and go-to-market.' Vellum did " +
        'not disclose any product details, pricing, customers, funding, team size, or launch date.',
      sourceIntelligence: {
        summary:
          "Vellum exited stealth with a short post saying it is 'building AI infrastructure for enterprises' and " +
          'hiring. No product, pricing, customers, funding, team size, or launch date were disclosed.',
        mainTopics: ['startup launch', 'AI infrastructure', 'enterprise software'],
        keywords: ['Vellum', 'stealth', 'AI infrastructure', 'enterprise', 'hiring'],
        contentAngles: ['What "AI infrastructure for enterprises" might mean', 'Reading signal from a vague launch'],
        claims: [
          { text: 'A startup called Vellum has exited stealth.', type: 'announcement', verifiable: true, extractionConfidence: 90 },
          { text: "Vellum says it is building 'AI infrastructure for enterprises'.", type: 'announcement', verifiable: true, extractionConfidence: 85 },
          { text: 'Vellum is hiring across engineering and go-to-market.', type: 'announcement', verifiable: true, extractionConfidence: 82 },
          { text: 'Vellum disclosed no product, pricing, customers, funding, team size, or launch date.', type: 'statistic', verifiable: true, extractionConfidence: 88 },
        ],
        entities: [{ name: 'Vellum', type: 'company' }],
        sentiment: 'neutral',
        importanceScore: 32,
        analysisConfidenceScore: 40,
        language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: [
      'Vellum exited stealth.',
      'It says it is building AI infrastructure for enterprises.',
      'It is hiring.',
      'No product, pricing, customers, funding, team size, or launch date were disclosed.',
    ],
    unsupportedClaims: [
      {
        text: 'A specific funding amount, round, or valuation.',
        detect: ['$', 'valuation', 'series a', 'series b', 'raised '],
        why: 'The source explicitly disclosed no financials. Any dollar figure, funding round, or valuation is fabricated.',
      },
    ],
    riskAreas: [
      'fabrication to fill an information vacuum',
      'confident specifics where the source gave none',
      'padding a 2-sentence story into a long, confident post (watch word count)',
    ],
  },
};
