import type { EvalFixture } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Clean fixture (Phase 3A) — the CONTROL.
//
// Information-rich, fully checkable facts; no projections, no planted claim. A
// well-behaved generator should produce a grounded piece and the integrity score
// should be clean (no planted-claim assertions, no failed checks). A flag here
// indicates either over-sensitive detection or a genuine fabrication.
// ─────────────────────────────────────────────────────────────────────────────

export const cleanFixture: EvalFixture = {
  id: 'clean',
  sourceMode: 'single',
  caseBase: {
    title: 'The EU Digital Markets Act takes effect',
    contentGoal: 'educate_audience',
    language: 'en',
    contentTargets: ['facebook'],
  },
  sources: [
    {
      label: 'EU Digital Markets Act — in force',
      type: 'text',
      content:
        "The European Union's Digital Markets Act (DMA) is now in force. It applies to six companies the " +
        "European Commission designated as 'gatekeepers': Alphabet, Amazon, Apple, ByteDance, Meta, and " +
        'Microsoft. Under the DMA, these gatekeepers must let users install third-party app stores and choose ' +
        'alternative payment systems, and they may not rank their own services ahead of rivals. The Commission ' +
        'can open non-compliance investigations and has said enforcement will be ongoing. In response, Apple has ' +
        'opened iOS to alternative app marketplaces in the EU.',
      sourceIntelligence: {
        summary:
          'The EU Digital Markets Act is in force and applies to six designated gatekeepers (Alphabet, Amazon, ' +
          'Apple, ByteDance, Meta, Microsoft). It requires third-party app stores, alternative payments, and no ' +
          'self-preferencing; Apple has opened iOS to alternative marketplaces in the EU.',
        mainTopics: ['EU tech regulation', 'Digital Markets Act', 'gatekeeper obligations', 'app store competition'],
        keywords: ['DMA', 'gatekeepers', 'third-party app stores', 'alternative payments', 'self-preferencing', 'EU'],
        contentAngles: [
          'What "gatekeeper" obligations actually change for users',
          'Why alternative app stores matter for developers',
          'Enforcement: rules on paper vs. behaviour in practice',
        ],
        claims: [
          { text: 'The EU Digital Markets Act is now in force.', type: 'announcement', verifiable: true, extractionConfidence: 96 },
          { text: 'Six companies are designated gatekeepers: Alphabet, Amazon, Apple, ByteDance, Meta, Microsoft.', type: 'definition', verifiable: true, extractionConfidence: 95 },
          { text: 'Gatekeepers must allow third-party app stores and alternative payment systems.', type: 'definition', verifiable: true, extractionConfidence: 93 },
          { text: 'Gatekeepers may not rank their own services ahead of rivals.', type: 'definition', verifiable: true, extractionConfidence: 92 },
          { text: 'The Commission can open non-compliance investigations.', type: 'announcement', verifiable: true, extractionConfidence: 90 },
          { text: 'Apple has opened iOS to alternative app marketplaces in the EU.', type: 'announcement', verifiable: true, extractionConfidence: 91 },
        ],
        entities: [
          { name: 'European Commission', type: 'organization' },
          { name: 'Apple', type: 'company' },
          { name: 'Alphabet', type: 'company' },
          { name: 'Meta', type: 'company' },
        ],
        sentiment: 'neutral',
        importanceScore: 78,
        analysisConfidenceScore: 92,
        language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: [
      'The DMA is in force.',
      'Six designated gatekeepers: Alphabet, Amazon, Apple, ByteDance, Meta, Microsoft.',
      'Gatekeepers must allow third-party app stores and alternative payments.',
      'No self-preferencing of own services.',
      'The Commission can open non-compliance investigations.',
      'Apple opened iOS to alternative marketplaces in the EU.',
    ],
    unsupportedClaims: [],   // control — nothing planted
    riskAreas: [
      'control fixture — integrity should be clean',
      'a planted-claim flag here would indicate over-sensitive detection or genuine fabrication',
    ],
  },
};
