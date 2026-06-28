import type { EvalFixture } from '../types';

// Coherence-validation fixture (eval-only). Sources that look SURFACE-UNRELATED
// (cloud pricing / startup finance / enterprise budgets) but share ONE genuine
// hidden driver: rising compute cost squeezing the whole AI value chain. This is
// LumAI's core value — a real cross-source insight. Phase 4A must NOT flag this as
// incoherent; it should produce a single_mechanism hidden-driver thesis.

export const genuineHiddenDriverFixture: EvalFixture = {
  id: 'genuine_hidden_driver',
  sourceMode: 'multi',
  caseBase: { title: 'The hidden squeeze in AI', contentGoal: 'build_authority', language: 'en', contentTargets: ['facebook'] },
  sources: [
    {
      label: 'Cloud providers raise GPU instance prices',
      type: 'text',
      content: 'Major cloud providers raised prices on H100 GPU instances by double digits, citing sustained demand and supply constraints. Reserved-capacity discounts also shrank.',
      sourceIntelligence: {
        summary: 'Major cloud providers raised H100 GPU instance prices by double digits on sustained demand and supply constraints; reserved-capacity discounts shrank.',
        mainTopics: ['cloud pricing', 'GPU costs', 'compute supply'],
        keywords: ['H100', 'GPU prices', 'cloud', 'capacity', 'compute cost'],
        contentAngles: ['Why compute pricing power is shifting to providers'],
        claims: [
          { text: 'Cloud providers raised H100 GPU instance prices by double digits.', type: 'statistic', verifiable: true, extractionConfidence: 86 },
          { text: 'Reserved-capacity discounts shrank.', type: 'claim', verifiable: true, extractionConfidence: 78 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 70, analysisConfidenceScore: 82, language: 'en',
      },
    },
    {
      label: 'AI startups extend runway with bridge rounds',
      type: 'text',
      content: 'AI infrastructure startups are burning cash faster than projected; several have raised bridge rounds to extend runway, with investors pressing for clearer paths to gross-margin positive.',
      sourceIntelligence: {
        summary: 'AI infrastructure startups are burning cash faster than projected and raising bridge rounds to extend runway; investors press for margin clarity.',
        mainTopics: ['startup finance', 'runway', 'AI infrastructure', 'venture funding'],
        keywords: ['bridge round', 'cash burn', 'runway', 'gross margin', 'startups'],
        contentAngles: ['The financial strain inside the AI build-out'],
        claims: [
          { text: 'AI infrastructure startups are burning cash faster than projected.', type: 'claim', verifiable: false, extractionConfidence: 74 },
          { text: 'Several raised bridge rounds to extend runway.', type: 'announcement', verifiable: true, extractionConfidence: 80 },
        ],
        entities: [], sentiment: 'negative', importanceScore: 68, analysisConfidenceScore: 78, language: 'en',
      },
    },
    {
      label: 'CFOs scrutinize AI pilot budgets',
      type: 'text',
      content: 'Enterprise CFOs are scrutinizing AI pilot budgets as compute bills exceed forecasts, and some are pausing expansions until per-query costs come down.',
      sourceIntelligence: {
        summary: 'Enterprise CFOs are scrutinizing AI pilot budgets as compute bills exceed forecasts; some pause expansions pending lower per-query costs.',
        mainTopics: ['enterprise budgets', 'AI adoption', 'compute bills', 'CFO scrutiny'],
        keywords: ['CFO', 'AI pilots', 'compute bills', 'per-query cost', 'budgets'],
        contentAngles: ['Why AI adoption stalls at the budget line'],
        claims: [
          { text: 'Enterprise CFOs are scrutinizing AI pilot budgets as compute bills exceed forecasts.', type: 'claim', verifiable: false, extractionConfidence: 76 },
          { text: 'Some enterprises pause AI expansions pending lower per-query costs.', type: 'claim', verifiable: false, extractionConfidence: 70 },
        ],
        entities: [], sentiment: 'negative', importanceScore: 69, analysisConfidenceScore: 79, language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: ['GPU instance prices rose double digits.', 'AI startups raised bridge rounds.', 'CFOs are scrutinizing AI compute budgets.'],
    unsupportedClaims: [],
    riskAreas: ['GENUINE hidden driver (rising compute cost squeezing the value chain) — Phase 4A must NOT flag this as a roundup; it should produce a single_mechanism cross-source insight'],
  },
};
