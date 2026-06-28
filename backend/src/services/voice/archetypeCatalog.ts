import type { Archetype, Surface, Structural } from '../../schemas/voiceProfileSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Archetype catalog (Phase 2A — lean v1: 3 archetypes)
//
// Each archetype is a structural PALETTE + surface defaults — NOT a rigid post
// template. It defines preferred/discouraged moves and dial defaults; the resolver
// then nudges those dials per goal/audience/aiInstructions. The generator (later,
// Phase 2B) is free to vary WITHIN the palette, so two posts of the same archetype
// are not carbon copies.
//
// Extensibility: to add an archetype, add its value to ArchetypeSchema and one
// entry here. Nothing else in the resolver signature changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchetypeDefaults {
  surface:    Surface;
  structural: Structural;
}

// Fact floor is invariant and identical for every archetype. Exported so the
// resolver attaches exactly one canonical copy and never derives it from voice.
export const FACT_FLOOR = {
  noFabrication:                true,
  noFalseCertainty:             true,
  forbidConflictingAsFact:      true,
  noFabricatedStatsQuotesDates: true,
  languageStrict:               true,
} as const;

export const ARCHETYPE_CATALOG: Record<Archetype, ArchetypeDefaults> = {
  // Cautious senior strategist — the current de-facto LumAI voice, now one option
  // among several rather than the universal substrate.
  analytical: {
    surface: { formality: 3, warmth: 1, humor: 0, boldness: 2, emotionalIntensity: 1, cadence: 2 },
    structural: {
      openingMoves: {
        preferred:   ['synthesized_insight', 'data_point'],
        discouraged: ['hot_take', 'personal_anecdote', 'scene'],
        default:     'synthesized_insight',
      },
      argumentFlow:        'insight_first',
      counterArgumentMode: 'weave_required',
      hedgeTolerance:      'high',
      storytelling:        'seasoning',
      closingStyle: { preferred: ['landing_insight', 'forward_look'], default: 'landing_insight' },
      paragraphRhythm:     'varied',
    },
  },

  // Warm, conversational opinion-leader — natural, expressive, engaging.
  creator: {
    surface: { formality: 1, warmth: 3, humor: 2, boldness: 2, emotionalIntensity: 2, cadence: 1 },
    structural: {
      openingMoves: {
        preferred:   ['question', 'personal_anecdote', 'hot_take'],
        discouraged: ['definition', 'data_point'],
        default:     'question',
      },
      argumentFlow:        'insight_first',
      counterArgumentMode: 'acknowledge_light',
      hedgeTolerance:      'medium',
      storytelling:        'seasoning',
      closingStyle: { preferred: ['audience_question', 'cta'], default: 'audience_question' },
      paragraphRhythm:     'punchy',
    },
  },

  // Provocative, opinionated, consensus-challenging — takes strong positions.
  // counterArgumentMode 'optional' = NOT required to perform the balanced weave;
  // the fact floor still forbids stating speculation as fact (no false certainty).
  contrarian: {
    surface: { formality: 1, warmth: 1, humor: 1, boldness: 4, emotionalIntensity: 3, cadence: 0 },
    structural: {
      openingMoves: {
        preferred:   ['provocation', 'contrarian_claim', 'hot_take'],
        discouraged: ['synthesized_insight', 'definition', 'data_point'],
        default:     'contrarian_claim',
      },
      argumentFlow:        'provocation_first',
      counterArgumentMode: 'optional',
      hedgeTolerance:      'low',
      storytelling:        'seasoning',
      closingStyle: { preferred: ['challenge', 'audience_question'], default: 'challenge' },
      paragraphRhythm:     'punchy',
    },
  },
};
