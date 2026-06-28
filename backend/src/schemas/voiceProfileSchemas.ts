import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Voice Profile schema (Phase 2A — Voice-Aware Generation foundation)
//
// A VoiceProfile is the resolved, deterministic description of HOW a piece should
// be written for a given case. It has three layers:
//   1. surface     — lexical/tonal dials (formality, warmth, …). Ordinal 0–4.
//   2. structural  — the writing-behaviour palette (openings, flow, hedging, …).
//   3. factFloor   — INVARIANT integrity rules. Never derived from voice, never
//                    user-overridable. Present here so the generator reads one
//                    object; mirrors the existing GeneratorInput.policy intent.
//
// This schema is intentionally NOT wired into the generator in Phase 2A. It is
// produced by resolveVoiceProfile() and consumed only by tests until Phase 2B.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

// Lean v1 catalog — three archetypes. Extensible: add a value here + a catalog
// entry to introduce a new archetype, with no resolver signature change.
export const ArchetypeSchema = z.enum(['analytical', 'creator', 'contrarian']);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const OpeningMoveSchema = z.enum([
  'synthesized_insight', 'provocation', 'contrarian_claim',
  'personal_anecdote', 'scene', 'hot_take',
  'question', 'data_point', 'definition',
]);
export type OpeningMove = z.infer<typeof OpeningMoveSchema>;

export const ClosingMoveSchema = z.enum([
  'landing_insight', 'audience_question', 'cta',
  'challenge', 'forward_look', 'callback',
]);
export type ClosingMove = z.infer<typeof ClosingMoveSchema>;

export const ArgumentFlowSchema = z.enum([
  'insight_first', 'story_first', 'provocation_first',
  'claim_first', 'explainer_sequential',
]);
export type ArgumentFlow = z.infer<typeof ArgumentFlowSchema>;

export const CounterArgModeSchema = z.enum(['weave_required', 'acknowledge_light', 'optional', 'omit']);
export type CounterArgMode = z.infer<typeof CounterArgModeSchema>;

export const HedgeToleranceSchema = z.enum(['low', 'medium', 'high']);
export type HedgeTolerance = z.infer<typeof HedgeToleranceSchema>;

export const StorytellingSchema = z.enum(['none', 'seasoning', 'spine']);
export type Storytelling = z.infer<typeof StorytellingSchema>;

export const ParagraphRhythmSchema = z.enum(['uniform', 'varied', 'punchy']);
export type ParagraphRhythm = z.infer<typeof ParagraphRhythmSchema>;

export const ArchetypeSourceSchema = z.enum([
  'aiInstructions', 'contentStyle', 'styleCustom', 'contentGoal', 'default',
]);
export type ArchetypeSource = z.infer<typeof ArchetypeSourceSchema>;

// ── Layer 1: Surface ─────────────────────────────────────────────────────────
// Ordinal intensity 0–4 so the resolver can apply additive nudges and clamp.
const Level = z.number().int().min(0).max(4);

export const SurfaceSchema = z.object({
  formality:          Level,
  warmth:             Level,
  humor:              Level,
  boldness:           Level,   // lexical assertiveness of STANCE — not factual certainty
  emotionalIntensity: Level,
  cadence:            Level,    // 0 = short/punchy … 4 = long/flowing
});
export type Surface = z.infer<typeof SurfaceSchema>;

// ── Layer 2: Structural ──────────────────────────────────────────────────────
export const StructuralSchema = z.object({
  openingMoves: z.object({
    preferred:   z.array(OpeningMoveSchema),
    discouraged: z.array(OpeningMoveSchema),
    default:     OpeningMoveSchema,
  }),
  argumentFlow:        ArgumentFlowSchema,
  counterArgumentMode: CounterArgModeSchema,  // EXPRESSION policy only — see factFloor
  hedgeTolerance:      HedgeToleranceSchema,   // how much uncertainty is surfaced
  storytelling:        StorytellingSchema,
  closingStyle: z.object({
    preferred: z.array(ClosingMoveSchema),
    default:   ClosingMoveSchema,
  }),
  paragraphRhythm:     ParagraphRhythmSchema,
});
export type Structural = z.infer<typeof StructuralSchema>;

// ── Layer 3: Fact Floor (INVARIANT) ──────────────────────────────────────────
// Every field is a literal `true`. Voice can influence the EXPRESSION of
// uncertainty (hedgeTolerance, counterArgumentMode) but can NEVER lower this.
export const FactFloorSchema = z.object({
  noFabrication:                z.literal(true),
  noFalseCertainty:             z.literal(true),
  forbidConflictingAsFact:      z.literal(true),
  noFabricatedStatsQuotesDates: z.literal(true),
  languageStrict:               z.literal(true),
});
export type FactFloor = z.infer<typeof FactFloorSchema>;

// ── Meta (traceability) ──────────────────────────────────────────────────────
export const VoiceMetaSchema = z.object({
  resolverVersion:     z.string().min(1),
  archetypeSource:     ArchetypeSourceSchema,
  appliedModifiers:    z.array(z.string()),   // e.g. 'goal:grow_community', 'audience:founders'
  droppedInstructions: z.array(z.string()),   // fact-floor-violating instructions that were refused
});
export type VoiceMeta = z.infer<typeof VoiceMetaSchema>;

// ── VoiceProfile ─────────────────────────────────────────────────────────────
export const VoiceProfileSchema = z.object({
  archetype:  ArchetypeSchema,
  surface:    SurfaceSchema,
  structural: StructuralSchema,
  factFloor:  FactFloorSchema,
  meta:       VoiceMetaSchema,
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
