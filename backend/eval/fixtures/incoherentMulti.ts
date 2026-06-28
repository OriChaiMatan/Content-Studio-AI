import type { EvalFixture } from '../types';

// Coherence-validation fixture (eval-only). FOUR deliberately UNRELATED sources
// (ad monetization, hardware, chip earnings, regulation). No single thread should
// naturally connect them; a forced thesis would be strained. Used to check whether
// persisted research signals read as incoherent — or whether synthesis manufactures
// a convincing link anyway. NOT part of the generation matrix.

export const incoherentMultiFixture: EvalFixture = {
  id: 'incoherent_multi',
  sourceMode: 'multi',
  caseBase: { title: 'AI industry roundup', contentGoal: 'build_authority', language: 'en', contentTargets: ['facebook'] },
  sources: [
    {
      label: 'Meta integrates AI across its ad stack',
      type: 'text',
      content: 'Meta is integrating AI across its advertising stack to boost engagement and ad targeting, framing AI as a monetization engine for Facebook and Instagram and reporting improved ad performance.',
      sourceIntelligence: {
        summary: 'Meta is integrating AI across its ad stack to improve targeting and engagement, framing AI as a monetization engine for Facebook and Instagram.',
        mainTopics: ['Meta advertising', 'AI monetization', 'ad targeting', 'engagement'],
        keywords: ['Meta', 'ads', 'monetization', 'targeting', 'engagement'],
        contentAngles: ['AI as an ad-optimization engine'],
        claims: [{ text: 'Meta is integrating AI across its advertising stack.', type: 'announcement', verifiable: true, extractionConfidence: 85 }],
        entities: [{ name: 'Meta', type: 'company' }],
        sentiment: 'neutral', importanceScore: 66, analysisConfidenceScore: 80, language: 'en',
      },
    },
    {
      label: 'OpenAI is building AI-native hardware',
      type: 'text',
      content: 'OpenAI is developing AI-native hardware devices, hiring hardware talent to move beyond chat interfaces toward a dedicated AI device.',
      sourceIntelligence: {
        summary: 'OpenAI is developing AI-native hardware and hiring hardware talent to move beyond chat interfaces.',
        mainTopics: ['AI-native hardware', 'OpenAI strategy', 'devices'],
        keywords: ['OpenAI', 'hardware', 'devices', 'interface'],
        contentAngles: ['A model company moving into hardware'],
        claims: [{ text: 'OpenAI is developing AI-native hardware devices.', type: 'announcement', verifiable: true, extractionConfidence: 86 }],
        entities: [{ name: 'OpenAI', type: 'company' }],
        sentiment: 'neutral', importanceScore: 70, analysisConfidenceScore: 82, language: 'en',
      },
    },
    {
      label: 'Nvidia reports record data-center revenue',
      type: 'text',
      content: 'Nvidia reported record quarterly revenue driven by data-center GPU demand, beating analyst estimates. Gross margins expanded and the company issued strong forward guidance.',
      sourceIntelligence: {
        summary: 'Nvidia reported record quarterly revenue on data-center GPU demand, beat estimates, expanded margins, and gave strong guidance.',
        mainTopics: ['Nvidia earnings', 'data-center GPUs', 'revenue', 'financial results'],
        keywords: ['Nvidia', 'earnings', 'data center', 'GPU', 'margins', 'guidance'],
        contentAngles: ['The economics of the AI buildout'],
        claims: [
          { text: 'Nvidia reported record quarterly revenue driven by data-center GPU demand.', type: 'statistic', verifiable: true, extractionConfidence: 88 },
          { text: 'Nvidia beat analyst estimates and expanded gross margins.', type: 'statistic', verifiable: true, extractionConfidence: 84 },
        ],
        entities: [{ name: 'Nvidia', type: 'company' }],
        sentiment: 'positive', importanceScore: 74, analysisConfidenceScore: 85, language: 'en',
      },
    },
    {
      label: 'The EU AI Act enters into force',
      type: 'text',
      content: 'The European Union\'s AI Act entered into force, imposing risk-tiered obligations on AI systems with strict requirements for high-risk uses and fines for non-compliance.',
      sourceIntelligence: {
        summary: 'The EU AI Act entered into force, imposing risk-tiered obligations, strict high-risk requirements, and fines for non-compliance.',
        mainTopics: ['EU AI regulation', 'AI Act', 'compliance', 'risk tiers'],
        keywords: ['EU', 'AI Act', 'regulation', 'high-risk', 'fines', 'compliance'],
        contentAngles: ['What risk-tiered AI regulation changes'],
        claims: [
          { text: 'The EU AI Act entered into force with risk-tiered obligations.', type: 'announcement', verifiable: true, extractionConfidence: 90 },
          { text: 'High-risk AI systems face strict requirements and non-compliance fines.', type: 'definition', verifiable: true, extractionConfidence: 86 },
        ],
        entities: [{ name: 'European Union', type: 'organization' }],
        sentiment: 'neutral', importanceScore: 72, analysisConfidenceScore: 86, language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: ['Meta integrates AI into ads.', 'OpenAI is building hardware.', 'Nvidia beat earnings.', 'The EU AI Act is in force.'],
    unsupportedClaims: [],
    riskAreas: ['coherence fixture — sources are UNRELATED; a single strong thesis should be strained or absent'],
  },
};
