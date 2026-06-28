import { HEDGE_MARKERS, splitSentences } from './integrity';

// ─────────────────────────────────────────────────────────────────────────────
// Persona-separation metrics (Phase 3A) — deterministic, no Claude.
//
// Simple bilingual (EN+HE) text features that should differ across personas:
// an analytical piece hedges more and weaves more counter-arguments; a contrarian
// hedges less, takes more direct stances. We surface the raw vector per cell and
// a few expected-ordering checks per fixture. No LLM judge.
// ─────────────────────────────────────────────────────────────────────────────

const lc = (s: string): string => s.toLowerCase();
const countOccurrences = (text: string, marker: string): number => {
  if (!marker) return 0;
  return lc(text).split(lc(marker)).length - 1;
};

// Contrast / counter-argument markers.
const CONTRAST_MARKERS: string[] = [
  'but ', 'however', 'although', 'though ', 'on the other hand', 'yet ',
  'that said', 'to be fair', 'admittedly', 'of course,', 'then again', 'still,',
  'אבל', 'לעומת', 'אולם', 'עם זאת', 'מצד שני', 'אמנם',
];

// Direct first-person / strong-stance markers.
const STANCE_MARKERS: string[] = [
  'i think', "i'd argue", 'i believe', 'i’d argue', 'make no mistake',
  "let's be honest", 'let’s be honest', 'the real ', "here's the thing",
  'here’s the thing', 'frankly', 'the truth is', 'in my view', 'mark my words',
  'לדעתי', 'אני חושב', 'בואו נודה', 'האמת היא', 'למען האמת', 'תכלס',
];

export interface SeparationMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;       // words / sentence
  sentenceLengthStdev: number;
  hedgeDensity: number;            // hedge markers per 100 words
  counterargumentCount: number;
  rhetoricalQuestionCount: number;
  directStanceCount: number;
  openingCategory: string;
}

function classifyOpening(text: string): string {
  const first = (splitSentences(text)[0] ?? '').trim();
  const f = lc(first);
  if (!first) return 'none';
  if (/[?]\s*$/.test(text.split('\n')[0] ?? first) || first.includes('?')) return 'question';
  if (/^(what if|imagine|stop |forget |here'?s why|picture )/i.test(first)) return 'provocation';
  if (/\d/.test(first)) return 'data_point';
  if (/^(i |when i |my |a few years ago|last )/i.test(first) || f.startsWith('i ')) return 'anecdote';
  return 'statement';
}

export function computeSeparation(text: string): SeparationMetrics {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const sentenceCount = sentences.length || 1;
  const avg = lengths.reduce((a, b) => a + b, 0) / sentenceCount;
  const variance = lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / sentenceCount;

  const hedges = HEDGE_MARKERS.reduce((sum, m) => sum + countOccurrences(text, m), 0);
  const counters = CONTRAST_MARKERS.reduce((sum, m) => sum + countOccurrences(text, m), 0);
  const stances = STANCE_MARKERS.reduce((sum, m) => sum + countOccurrences(text, m), 0);
  const rhetoricalQuestions = (text.match(/\?/g) ?? []).length;

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength: round(avg),
    sentenceLengthStdev: round(Math.sqrt(variance)),
    hedgeDensity: round(wordCount ? (hedges / wordCount) * 100 : 0),
    counterargumentCount: counters,
    rhetoricalQuestionCount: rhetoricalQuestions,
    directStanceCount: stances,
    openingCategory: classifyOpening(text),
  };
}

function round(n: number): number { return Math.round(n * 10) / 10; }
