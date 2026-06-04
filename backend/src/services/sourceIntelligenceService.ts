import { SourceIntelligenceSchema, type SourceIntelligence } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Source Intelligence Service — deterministic mock analysis
//
// No randomness, no AI calls. Produces the same output for the same input.
// Phase 8 replacement: swap this function for a real AI summarization call.
// The schema validation, persistence, and UI layers are already in place.
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

  // ── Claims: sentences from text; references for URL/PDF ──────────────────────
  const claims =
    type === 'text'
      ? (content.match(/[^.!?]+[.!?]+/g) ?? [])
          .map(s => s.trim())
          .filter(s => s.length > 15 && s.length < 200)
          .slice(0, 3)
      : type === 'url'
      ? [`Source references external URL: ${content}`]
      : [`Document "${label || content}" referenced as research material.`];

  // ── Sentiment: keyword scanning ───────────────────────────────────────────────
  const posScore = POSITIVE_WORDS.filter(w => lowerContent.includes(w)).length;
  const negScore = NEGATIVE_WORDS.filter(w => lowerContent.includes(w)).length;
  const sentiment: SourceIntelligence['sentiment'] =
    posScore > negScore + 1 ? 'positive' :
    negScore > posScore + 1 ? 'negative' :
    posScore === 0 && negScore === 0 ? 'neutral' :
    'mixed';

  // ── Confidence: based on source type and content richness ─────────────────────
  const confidenceScore =
    type === 'text'
      ? content.length > 300 ? 88 : content.length > 100 ? 80 : 65
      : type === 'url' ? 72
      : 75;

  const intelligence: SourceIntelligence = {
    summary,
    topics:          topics.slice(0, 5),
    keywords:        finalKeywords.length > 0 ? finalKeywords.slice(0, 7) : ['content'],
    claims:          claims.slice(0, 3),
    sentiment,
    confidenceScore,
  };

  return SourceIntelligenceSchema.parse(intelligence);
}
