import type { EvalFixture } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tension fixture (Phase 3A) — two sources, genuinely opposed readings.
//
// Source 1 frames Meta's AI push as a platform-defining future vision. Source 2
// shows the only concrete result is a self-reported, unvalidated 18% CTR rise.
// Tests: (a) does the mock surface the cross-source contradiction? (it never does
// — conflictingClaims is always []); (b) does a persona assert the self-reported
// 18% as validated success? ("18%" is the deterministic probe); (c) persona stance
// — contrarian should commit harder to one pole than analytical.
// ─────────────────────────────────────────────────────────────────────────────

export const multiTensionFixture: EvalFixture = {
  id: 'multi-tension',
  sourceMode: 'multi',
  caseBase: {
    title: 'Is Meta building the future of AI, or optimizing ads?',
    contentGoal: 'build_authority',
    language: 'en',
    contentTargets: ['facebook'],
  },
  sources: [
    {
      label: 'Meta frames AI as a core platform layer',
      type: 'text',
      content:
        'Meta says AI is now a core layer across Facebook, Instagram, and WhatsApp. Mark Zuckerberg has described ' +
        'AI as central to every product, and the company is investing billions in infrastructure and custom ' +
        'silicon and hiring senior AI researchers.',
      sourceIntelligence: {
        summary:
          'Meta frames AI as a core layer across its products; Zuckerberg calls it central to every product, and ' +
          'the company is investing billions in infrastructure, custom silicon, and senior AI hires.',
        mainTopics: ['Meta AI strategy', 'platform vision', 'AI infrastructure', 'custom silicon'],
        keywords: ['Meta', 'Zuckerberg', 'AI core layer', 'custom silicon', 'infrastructure'],
        contentAngles: ['AI as a platform layer vs. a feature', 'Why custom silicon signals long-term intent'],
        claims: [
          { text: 'Meta says AI is a core layer across Facebook, Instagram, and WhatsApp.', type: 'announcement', verifiable: true, extractionConfidence: 90 },
          { text: 'Zuckerberg describes AI as central to every Meta product.', type: 'opinion', verifiable: true, extractionConfidence: 85 },
          { text: 'Meta is investing billions in AI infrastructure and custom silicon.', type: 'announcement', verifiable: true, extractionConfidence: 84 },
        ],
        entities: [{ name: 'Meta', type: 'company' }, { name: 'Mark Zuckerberg', type: 'person' }],
        sentiment: 'positive',
        importanceScore: 72,
        analysisConfidenceScore: 86,
        language: 'en',
      },
    },
    {
      label: "Meta's only concrete metric is a self-reported CTR rise",
      type: 'text',
      content:
        "Meta's internal metrics reported an 18% rise in ad click-through rates after rolling out AI-based ranking. " +
        'Meta has not published independent or third-party validation of these figures.',
      sourceIntelligence: {
        summary:
          "Meta's internal metrics reported an 18% rise in ad click-through rates after AI-based ranking, with no " +
          'independent or third-party validation published.',
        mainTopics: ['ad performance', 'click-through rate', 'self-reported metrics', 'AI ranking'],
        keywords: ['CTR', '18%', 'ad ranking', 'internal metrics', 'no independent validation'],
        contentAngles: ['CTR as a proxy for value', 'Self-reported metrics vs. validated outcomes'],
        claims: [
          { text: 'Meta internally reported an 18% rise in ad click-through rates after AI-based ranking.', type: 'statistic', verifiable: false, extractionConfidence: 80 },
          { text: 'Meta has not published independent validation of the figures.', type: 'statistic', verifiable: true, extractionConfidence: 88 },
        ],
        entities: [{ name: 'Meta', type: 'company' }],
        sentiment: 'neutral',
        importanceScore: 68,
        analysisConfidenceScore: 82,
        language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: [
      'Meta frames AI as a core layer across its products.',
      'Meta is investing in infrastructure and custom silicon.',
      'Meta internally reported an 18% CTR rise after AI ranking.',
      'No independent validation of the 18% has been published.',
    ],
    unsupportedClaims: [
      {
        text: 'The AI delivered an 18% improvement, stated as validated success.',
        detect: ['18%', '18 percent'],
        why:
          'The 18% is Meta\'s own internal, unvalidated CTR figure. Stating it as proven business success — ' +
          'rather than a self-reported metric — is overreach (a real fact check should mark it uncertain).',
      },
    ],
    knownContradictions: [
      {
        a: 'Meta frames AI as a platform-defining future vision.',
        b: 'The only concrete result is a self-reported 18% CTR rise with no independent validation.',
      },
    ],
    riskAreas: [
      'single-source self-reported metric stated as validated success',
      'asserting one pole of a genuine tension as settled fact',
      'cross-source contradiction never surfaced by the mock fact check',
    ],
  },
};
