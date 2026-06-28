import type { EvalFixture } from '../types';

// Coherence-validation fixture (eval-only). FOUR sources that share one thread —
// the human–AI interface / AI-native hardware story — and should naturally support
// ONE strong thesis. Used to check whether persisted research signals read as
// coherent. NOT part of the generation matrix.

export const coherentMultiFixture: EvalFixture = {
  id: 'coherent_multi',
  sourceMode: 'multi',
  caseBase: { title: 'The AI interface battle', contentGoal: 'build_authority', language: 'en', contentTargets: ['facebook'] },
  sources: [
    {
      label: 'OpenAI is building AI-native hardware',
      type: 'text',
      content: 'OpenAI is building dedicated hardware for AI-native interaction, hiring hardware engineers and partnering on custom devices, signaling a move beyond chat apps toward a primary AI device.',
      sourceIntelligence: {
        summary: 'OpenAI is investing in AI-native hardware and hiring hardware talent to move beyond chat interfaces toward a primary AI device.',
        mainTopics: ['AI-native hardware', 'OpenAI strategy', 'human-AI interaction', 'devices'],
        keywords: ['OpenAI', 'AI hardware', 'devices', 'interface', 'beyond chat'],
        contentAngles: ['Why a model company builds hardware', 'The device as the new interface'],
        claims: [
          { text: 'OpenAI is building dedicated AI-native hardware.', type: 'announcement', verifiable: true, extractionConfidence: 88 },
          { text: 'OpenAI is hiring hardware engineers and partnering on custom devices.', type: 'announcement', verifiable: true, extractionConfidence: 85 },
        ],
        entities: [{ name: 'OpenAI', type: 'company' }],
        sentiment: 'neutral', importanceScore: 72, analysisConfidenceScore: 84, language: 'en',
      },
    },
    {
      label: 'OpenAI acquires Jony Ive\'s io for ~$6.5B',
      type: 'text',
      content: 'OpenAI acquired Jony Ive\'s hardware startup io for approximately $6.5 billion to design AI-native consumer devices. Ive led iPhone design at Apple and is now focused on rethinking how people interact with intelligence.',
      sourceIntelligence: {
        summary: 'OpenAI acquired Jony Ive\'s startup io (~$6.5B) to design AI-native consumer devices; Ive previously led iPhone design.',
        mainTopics: ['Jony Ive acquisition', 'AI-native devices', 'consumer hardware', 'design'],
        keywords: ['Jony Ive', 'io', 'acquisition', 'consumer devices', 'iPhone'],
        contentAngles: ['Design pedigree as a moat', 'Buying the interface layer'],
        claims: [
          { text: 'OpenAI acquired Jony Ive\'s startup io for ~$6.5 billion.', type: 'announcement', verifiable: true, extractionConfidence: 90 },
          { text: 'The acquisition targets AI-native consumer devices.', type: 'announcement', verifiable: true, extractionConfidence: 84 },
        ],
        entities: [{ name: 'OpenAI', type: 'company' }, { name: 'Jony Ive', type: 'person' }],
        sentiment: 'positive', importanceScore: 80, analysisConfidenceScore: 86, language: 'en',
      },
    },
    {
      label: 'A wave of screenless AI-native devices',
      type: 'text',
      content: 'A wave of startups is building screenless AI-native devices — pendants, pins, and glasses — aiming to replace app-based smartphone interaction with ambient, always-available AI.',
      sourceIntelligence: {
        summary: 'Startups are building screenless AI-native devices (pendants, pins, glasses) to replace app-based smartphone interaction with ambient AI.',
        mainTopics: ['AI-native devices', 'ambient computing', 'post-smartphone', 'wearables'],
        keywords: ['screenless', 'ambient AI', 'pendants', 'glasses', 'post-app'],
        contentAngles: ['Ambient AI vs the app model', 'Is the smartphone the incumbent to beat?'],
        claims: [
          { text: 'Startups are building screenless AI-native devices.', type: 'announcement', verifiable: true, extractionConfidence: 78 },
          { text: 'These devices aim to replace app-based smartphone interaction with ambient AI.', type: 'claim', verifiable: true, extractionConfidence: 72 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 65, analysisConfidenceScore: 76, language: 'en',
      },
    },
    {
      label: 'Analysts: the next battle is the human-AI interface layer',
      type: 'text',
      content: 'Analysts argue the next platform battle is the human-AI interface layer — who owns the primary way people interact with AI — not just who has the best model, since models are commoditizing.',
      sourceIntelligence: {
        summary: 'Analysts argue the next platform battle is the human-AI interface layer (who owns how people interact with AI), not model superiority, as models commoditize.',
        mainTopics: ['human-AI interface', 'platform competition', 'model commoditization', 'strategy'],
        keywords: ['interface layer', 'platform battle', 'commoditization', 'distribution'],
        contentAngles: ['Interface > model as the moat', 'Commoditization shifts the battleground'],
        claims: [
          { text: 'Analysts argue the next platform battle is the human-AI interface layer.', type: 'opinion', verifiable: false, extractionConfidence: 70 },
          { text: 'Models are commoditizing, shifting advantage to the interface.', type: 'prediction', verifiable: false, extractionConfidence: 65 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 70, analysisConfidenceScore: 74, language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: ['OpenAI is building AI-native hardware.', 'OpenAI acquired Jony Ive\'s io.', 'Startups are building screenless AI devices.'],
    unsupportedClaims: [],
    riskAreas: ['coherence fixture — sources SHOULD cohere into one interface-layer thesis'],
  },
};
