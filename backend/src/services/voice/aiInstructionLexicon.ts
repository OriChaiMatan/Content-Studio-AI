import type {
  Archetype, OpeningMove, ClosingMove, ArgumentFlow,
  CounterArgMode, HedgeTolerance, Storytelling, ParagraphRhythm, Surface,
} from '../../schemas/voiceProfileSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// AI-instruction lexicon (Phase 2A)
//
// DETERMINISTIC keyword parsing — NO LLM call. Matched phrases produce structured
// dial/structural nudges; the FULL raw aiInstructions text still flows to the
// generator later (Phase 2B), so the lexicon never needs to be exhaustive:
// unmatched text is simply not guessed here, it passes through downstream.
//
// A fact-floor DENYLIST refuses integrity-violating instructions and records them
// for auditability; they are never turned into adjustments.
// ─────────────────────────────────────────────────────────────────────────────

// An adjustment is additive for surface dials (deltas) and last-write-wins for
// structural set-fields. Order of application encodes precedence (see resolver).
export interface VoiceAdjustment {
  label: string;
  surface?: Partial<Record<keyof Surface, number>>;   // additive deltas
  structural?: {
    argumentFlow?:        ArgumentFlow;
    counterArgumentMode?: CounterArgMode;
    hedgeTolerance?:      HedgeTolerance;
    storytelling?:        Storytelling;
    paragraphRhythm?:     ParagraphRhythm;
    closingDefault?:      ClosingMove;
  };
  addPreferredOpenings?: OpeningMove[];
}

interface LexiconRule {
  patterns: RegExp[];
  adjustment: VoiceAdjustment;
}

// Style/structure rules. Patterns are case-insensitive. Each rule contributes its
// adjustment once if ANY pattern matches.
const LEXICON_RULES: LexiconRule[] = [
  {
    patterns: [/short sentences?/i, /\bpunchy\b/i, /\bconcise\b/i, /\bterse\b/i, /\bsnappy\b/i],
    adjustment: { label: 'ai:short_sentences', surface: { cadence: -2 }, structural: { paragraphRhythm: 'punchy' } },
  },
  {
    patterns: [/\bcasual(ly)?\b/i, /conversational/i, /\binformal\b/i],
    adjustment: { label: 'ai:casual', surface: { formality: -2 } },
  },
  {
    patterns: [/opinionated/i, /take a (strong )?stance/i, /strong opinions?/i, /don'?t hedge/i, /no hedging/i],
    adjustment: { label: 'ai:opinionated', surface: { boldness: 2 }, structural: { hedgeTolerance: 'low', counterArgumentMode: 'optional' } },
  },
  {
    patterns: [/storytell/i, /tell a story/i, /personal stor/i, /\banecdote/i, /narrative-driven/i],
    adjustment: { label: 'ai:storytelling', surface: { warmth: 1 }, structural: { storytelling: 'spine' }, addPreferredOpenings: ['personal_anecdote'] },
  },
  {
    patterns: [/data[-\s]?driven/i, /data[-\s]?backed/i, /\brigorous\b/i, /evidence[-\s]?based/i],
    adjustment: { label: 'ai:data_driven', structural: { hedgeTolerance: 'high' }, addPreferredOpenings: ['data_point'] },
  },
  {
    patterns: [/\bfounder\b/i, /startup voice/i, /like a founder/i],
    adjustment: { label: 'ai:founder', surface: { boldness: 1, formality: -1 } },
  },
  {
    patterns: [/\bfunny\b/i, /\bwitty\b/i, /\bhumou?r(ous)?\b/i, /\blighthearted\b/i],
    adjustment: { label: 'ai:humor', surface: { humor: 2 } },
  },
  {
    patterns: [/no emojis?/i, /buttoned[-\s]?up/i, /\bformal\b/i],
    adjustment: { label: 'ai:formal', surface: { formality: 1, humor: -1 } },
  },
];

// Fact-floor denylist. A match is REFUSED (never applied) and recorded.
const DENYLIST: { id: string; pattern: RegExp }[] = [
  { id: 'fabricate_stats',  pattern: /invent (a |some )?(stat|statistic|number|metric|figure|data)/i },
  { id: 'fabricate_quotes', pattern: /(make up|invent|fabricate) (a |some )?(quote|testimonial|source)/i },
  { id: 'fabricate_facts',  pattern: /(make up|invent|fabricate) (a |some )?(fact|study|claim)/i },
  { id: 'exaggerate',       pattern: /exaggerat(e|ing|ion)/i },
  { id: 'fabricate_generic',pattern: /\bfabricat(e|ing|ion)\b/i },
  { id: 'false_certainty',  pattern: /(state|present) .* as (certain|fact|proven)( even| when)? (if|when) (it'?s |they'?re )?not/i },
];

// Detect a STRONG archetype signal in free text. Only explicit voice-type words
// flip the archetype; dial words like "founder"/"casual" do NOT (they nudge dials
// via LEXICON_RULES instead). Returns the first matching archetype, or null.
const ARCHETYPE_SIGNALS: { archetype: Archetype; pattern: RegExp }[] = [
  { archetype: 'contrarian', pattern: /\b(contrarian|provocative|hot ?takes?|challenge (the )?consensus|against the grain|controversial)\b/i },
  { archetype: 'creator',    pattern: /\b(friendly creator|personal brand|like a creator|warm and personal|community[-\s]?driven)\b/i },
  { archetype: 'analytical', pattern: /\b(analytical|executive voice|like an analyst|research[-\s]?heavy|strategist|rigorous analysis)\b/i },
];

export function detectArchetypeSignal(text?: string | null): Archetype | null {
  if (!text) return null;
  for (const s of ARCHETYPE_SIGNALS) if (s.pattern.test(text)) return s.archetype;
  return null;
}

/**
 * Parse free-text instructions (aiInstructions or style/goal custom) into
 * structured adjustments + a list of refused fact-floor violations.
 * Pure and deterministic. Denylist matches are recorded, never applied; matched
 * style rules are still applied (the two concerns are orthogonal).
 */
export function parseInstructions(text?: string | null): { adjustments: VoiceAdjustment[]; dropped: string[] } {
  const result: { adjustments: VoiceAdjustment[]; dropped: string[] } = { adjustments: [], dropped: [] };
  if (!text || !text.trim()) return result;

  for (const d of DENYLIST) {
    const m = text.match(d.pattern);
    if (m) result.dropped.push(`${d.id}: "${m[0].trim()}"`);
  }
  for (const rule of LEXICON_RULES) {
    if (rule.patterns.some(p => p.test(text))) result.adjustments.push(rule.adjustment);
  }
  return result;
}
