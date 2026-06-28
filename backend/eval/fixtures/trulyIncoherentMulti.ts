import type { EvalFixture } from '../types';

// Coherence-validation fixture (eval-only). FOUR genuinely cross-domain sources —
// fintech IPO, climate agriculture, sports streaming rights, a food trend — with
// NO shared domain, actor, market, beneficiary, or plausible hidden-driver
// mechanism. Deliberately avoids AI/tech/markets-infra so there is no "everything
// funnels to X" thread. The coherence gate MUST fire here. NOT in the gen matrix.

export const trulyIncoherentMultiFixture: EvalFixture = {
  id: 'truly_incoherent_multi',
  sourceMode: 'multi',
  caseBase: { title: 'This week in the world', contentGoal: 'build_authority', language: 'en', contentTargets: ['facebook'] },
  sources: [
    {
      label: 'Brightpay fintech IPO prices at top of range',
      type: 'text',
      content: 'Payments startup Brightpay priced its IPO at the top of its range, raising $900 million. Shares jumped 22% on debut as investors bet on growth in consumer lending and embedded payments.',
      sourceIntelligence: {
        summary: 'Payments startup Brightpay priced its IPO at the top of its range, raising $900M; shares rose 22% on debut on optimism about consumer lending and embedded payments.',
        mainTopics: ['IPO', 'fintech', 'consumer lending', 'equity markets'],
        keywords: ['Brightpay', 'IPO', 'payments', 'consumer lending', 'debut'],
        contentAngles: ['What the debut pop says about fintech appetite'],
        claims: [
          { text: 'Brightpay priced its IPO at the top of its range, raising $900 million.', type: 'announcement', verifiable: true, extractionConfidence: 88 },
          { text: 'Shares jumped 22% on debut.', type: 'statistic', verifiable: true, extractionConfidence: 84 },
        ],
        entities: [{ name: 'Brightpay', type: 'company' }],
        sentiment: 'positive', importanceScore: 64, analysisConfidenceScore: 82, language: 'en',
      },
    },
    {
      label: 'Climate report warns of falling wheat yields',
      type: 'text',
      content: 'A new agricultural report warns that shifting rainfall patterns could cut wheat yields in the southern hemisphere by up to 12% over the next decade, raising food-security concerns for import-dependent regions.',
      sourceIntelligence: {
        summary: 'An agricultural report warns shifting rainfall could cut southern-hemisphere wheat yields up to 12% over a decade, raising food-security concerns.',
        mainTopics: ['climate change', 'agriculture', 'wheat yields', 'food security'],
        keywords: ['wheat', 'rainfall', 'yields', 'food security', 'southern hemisphere'],
        contentAngles: ['How rainfall shifts ripple into food prices'],
        claims: [
          { text: 'Shifting rainfall patterns could cut southern-hemisphere wheat yields by up to 12% over the next decade.', type: 'prediction', verifiable: false, extractionConfidence: 76 },
        ],
        entities: [], sentiment: 'negative', importanceScore: 70, analysisConfidenceScore: 80, language: 'en',
      },
    },
    {
      label: 'Soccer league signs $2.1B streaming rights deal',
      type: 'text',
      content: 'A national soccer league signed a five-year streaming rights deal worth $2.1 billion, moving most matches off broadcast television to a subscription platform starting next season.',
      sourceIntelligence: {
        summary: 'A national soccer league signed a 5-year, $2.1B streaming rights deal, moving most matches off broadcast TV to a subscription platform next season.',
        mainTopics: ['sports media', 'streaming rights', 'soccer', 'broadcast'],
        keywords: ['soccer', 'streaming rights', 'subscription', 'broadcast', 'league'],
        contentAngles: ['What leaving broadcast TV means for fans'],
        claims: [
          { text: 'A national soccer league signed a five-year streaming rights deal worth $2.1 billion.', type: 'announcement', verifiable: true, extractionConfidence: 86 },
          { text: 'Most matches will move off broadcast TV to a subscription platform.', type: 'announcement', verifiable: true, extractionConfidence: 80 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 66, analysisConfidenceScore: 81, language: 'en',
      },
    },
    {
      label: 'Fermented chili pastes are the breakout food trend',
      type: 'text',
      content: 'Fermented chili pastes are the breakout home-cooking trend this year, with recipe searches up sharply as consumers experiment with bold, gut-healthy condiments and document the results online.',
      sourceIntelligence: {
        summary: 'Fermented chili pastes are this year\'s breakout home-cooking trend, with recipe searches up sharply on interest in bold, gut-healthy condiments.',
        mainTopics: ['food trends', 'home cooking', 'fermentation', 'consumer behavior'],
        keywords: ['fermented chili', 'recipes', 'home cooking', 'condiments', 'gut health'],
        contentAngles: ['Why fermentation went mainstream at home'],
        claims: [
          { text: 'Fermented chili pastes are the breakout home-cooking trend this year, with recipe searches up sharply.', type: 'claim', verifiable: false, extractionConfidence: 70 },
        ],
        entities: [], sentiment: 'positive', importanceScore: 52, analysisConfidenceScore: 74, language: 'en',
      },
    },
  ],
  groundTruth: {
    supportedClaims: ['Brightpay IPO raised $900M, +22% on debut.', 'Wheat yields could fall up to 12%.', 'A soccer league signed a $2.1B streaming deal.', 'Fermented chili pastes are a breakout food trend.'],
    unsupportedClaims: [],
    riskAreas: [
      'TRULY cross-domain (fintech / climate-agri / sports-media / food) — no shared actor, market, beneficiary, or mechanism',
      'the coherence gate MUST fire: expect low/multi-topic, high forcedSynthesisRisk, multiple themes, outliers, and a single-cluster (not all-source) winner',
    ],
  },
};
