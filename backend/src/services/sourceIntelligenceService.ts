import { SourceIntelligenceSchema, type SourceIntelligence, type Claim, type Entity } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Source Intelligence Service — deterministic mock analysis
//
// No randomness, no AI calls. Produces the same output for the same input.
// This is the PERMANENT FALLBACK behind the Claude Source Analysis Agent
// (Phase 8). It always produces valid SourceIntelligence so adding a source
// never fails, even with no API key or when Claude is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
  'should', 'their', 'there', 'were', 'when', 'what', 'which', 'about',
  'into', 'than', 'then', 'also', 'more', 'some', 'such', 'only', 'other',
  'very', 'just', 'your', 'they', 'them', 'these', 'those', 'here', 'does',
  'http', 'https', 'www', 'com', 'the', 'and', 'for', 'are', 'not',
]);

const POSITIVE_WORDS = [
  'improve', 'growth', 'success', 'benefit', 'advance', 'increase',
  'effective', 'efficient', 'opportunity', 'positive', 'gain', 'better',
  'best', 'good', 'great', 'excellent', 'achieve', 'save', 'faster',
];

const NEGATIVE_WORDS = [
  'risk', 'fail', 'problem', 'decline', 'threat', 'danger', 'negative',
  'worse', 'bad', 'difficult', 'challenge', 'concern', 'issue', 'loss',
  'decrease', 'drop', 'costly', 'breach', 'vulnerability',
];

export function generateSourceIntelligence(
  type: string,
  label: string,
  content: string,
): SourceIntelligence {
  const lowerContent = content.toLowerCase();
  const words = content.split(/\s+/).filter(w => w.length > 0);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const summary =
    type === 'text'
      ? `${label ? `"${label}" discusses: ` : ''}${content.slice(0, 140).trimEnd()}${content.length > 140 ? '…' : ''}`
      : type === 'url'
      ? `Web reference${label ? ` — "${label}"` : ''}: ${content}`
      : `Document reference${label ? ` — "${label}"` : ''}: ${content}`;

  // ── Topics: capitalized multi-word phrases and domain terms ───────────────────
  const capitalizedWords = words
    .map(w => w.replace(/[^a-zA-Z]/g, ''))
    .filter(w => w.length > 3 && /^[A-Z]/.test(w));
  const uniqueCapitalized = [...new Set(capitalizedWords)].slice(0, 5);
  const labelTokens = label.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const topics = uniqueCapitalized.length > 0
    ? uniqueCapitalized
    : labelTokens.length > 0
    ? labelTokens
    : ['General topic'];

  // ── Keywords: top-frequency meaningful words ──────────────────────────────────
  const freqMap = new Map<string, number>();
  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length > 4 && !STOP_WORDS.has(clean)) {
      freqMap.set(clean, (freqMap.get(clean) ?? 0) + 1);
    }
  });
  const keywords =
    [...freqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([word]) => word);
  const finalKeywords = keywords.length > 0
    ? keywords
    : label.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 3).slice(0, 3);

  // ── Claims: structured Claim[] (new shape) ───────────────────────────────────
  const rawClaims =
    type === 'text'
      ? (content.match(/[^.!?]+[.!?]+/g) ?? [])
          .map(s => s.trim())
          .filter(s => s.length > 15 && s.length < 200)
          .slice(0, 3)
      : type === 'url'
      ? [`Source references external URL: ${content}`]
      : [`Document "${label || content}" referenced as research material.`];

  const claims: Claim[] = rawClaims.map(text => ({
    text,
    type: 'opinion' as const,         // mock cannot classify reliably; conservative default
    verifiable: type === 'text',      // text claims are at least checkable; url/pdf refs are not
    extractionConfidence: 60,         // mock extraction is low-confidence by design
    verificationStatus: 'unverified' as const,
  }));

  // ── Entities: capitalized tokens treated as generic technology/company terms ──
  const entities: Entity[] = uniqueCapitalized.slice(0, 6).map(name => ({
    name,
    type: 'technology' as const,      // mock cannot distinguish entity types
  }));

  // ── Sentiment: keyword scanning ───────────────────────────────────────────────
  const posScore = POSITIVE_WORDS.filter(w => lowerContent.includes(w)).length;
  const negScore = NEGATIVE_WORDS.filter(w => lowerContent.includes(w)).length;
  const sentiment: SourceIntelligence['sentiment'] =
    posScore > negScore + 1 ? 'positive' :
    negScore > posScore + 1 ? 'negative' :
    posScore === 0 && negScore === 0 ? 'neutral' :
    'mixed';

  // ── Importance: content richness as a coarse proxy ────────────────────────────
  const importanceScore =
    type === 'text'
      ? content.length > 500 ? 70 : content.length > 150 ? 55 : 40
      : type === 'url' ? 50
      : 50;

  // ── Analysis extraction confidence (NOT credibility) ──────────────────────────
  const analysisConfidenceScore =
    type === 'text'
      ? content.length > 300 ? 85 : content.length > 100 ? 75 : 60
      : type === 'url' ? 65
      : 70;

  // ── Content angles: derived generically from topics ───────────────────────────
  const contentAngles = topics.slice(0, 2).map(t => `Explore the implications of ${t}`);

  const intelligence: SourceIntelligence = {
    summary,
    mainTopics:              topics.slice(0, 5),
    keywords:                finalKeywords.length > 0 ? finalKeywords.slice(0, 7) : ['content'],
    claims,
    entities,
    sentiment,
    importanceScore,
    contentAngles,
    language:                'en',     // mock does not detect language
    analysisConfidenceScore,
    analysisVersion:         'mock-2',
    truncated:               false,
    analyzedAt:              new Date().toISOString(),
  };

  return SourceIntelligenceSchema.parse(intelligence);
}
