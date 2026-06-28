import {
  VoiceProfileSchema,
  type VoiceProfile,
  type Archetype,
  type ArchetypeSource,
} from '../../schemas/voiceProfileSchemas';
import { ARCHETYPE_CATALOG, FACT_FLOOR } from './archetypeCatalog';
import { parseInstructions, detectArchetypeSignal, type VoiceAdjustment } from './aiInstructionLexicon';

// ─────────────────────────────────────────────────────────────────────────────
// Voice Profile Resolver (Phase 2A)
//
// resolveVoiceProfile(case) -> VoiceProfile
//
// Pure, deterministic, synchronous. No I/O, no LLM, no DB. Currently UNUSED by the
// production flow — produced here, consumed by tests, wired into the generator in
// Phase 2B. Same input always yields the same VoiceProfile.
//
// Pipeline: choose archetype → goal modifiers → audience modifiers → custom
// overrides → aiInstructions overrides → normalize + validate. Application order
// encodes the precedence ladder (aiInstructions > customs > audience > goal >
// archetype). The fact floor is attached once and never derived from voice.
// ─────────────────────────────────────────────────────────────────────────────

const RESOLVER_VERSION = 'voice-resolver-1';

// Narrow structural input — a superset-compatible subset of Prisma's ContentCase,
// so resolveVoiceProfile(caseRecord) type-checks without importing @prisma/client.
export interface VoiceCaseInput {
  contentStyle?:   string | null;
  styleCustom?:    string | null;
  contentGoal?:    string | null;
  goalCustom?:     string | null;
  targetAudience?: string | null;
  aiInstructions?: string | null;
  language?:       string | null;   // not a voice dial — accepted and ignored here
}

// ── Stage 1 helpers: archetype selection ─────────────────────────────────────

const STYLE_TO_ARCHETYPE: Record<string, Archetype> = {
  professional:  'analytical',
  authoritative: 'analytical',
  journalistic:  'analytical',
  friendly:      'creator',
  personal:      'creator',
  humorous:      'creator',
  provocative:   'contrarian',
  // 'other' intentionally absent → falls through to styleCustom / goal / default
};

const GOAL_TO_ARCHETYPE: Record<string, Archetype> = {
  personal_branding: 'creator',
  grow_community:    'creator',
  // others → analytical default
};

function selectArchetype(c: VoiceCaseInput): { archetype: Archetype; source: ArchetypeSource } {
  const signal = detectArchetypeSignal(c.aiInstructions);
  if (signal) return { archetype: signal, source: 'aiInstructions' };

  if (c.contentStyle && STYLE_TO_ARCHETYPE[c.contentStyle]) {
    return { archetype: STYLE_TO_ARCHETYPE[c.contentStyle], source: 'contentStyle' };
  }
  const customSignal = detectArchetypeSignal(c.styleCustom);
  if (customSignal) return { archetype: customSignal, source: 'styleCustom' };

  if (c.contentGoal && GOAL_TO_ARCHETYPE[c.contentGoal]) {
    return { archetype: GOAL_TO_ARCHETYPE[c.contentGoal], source: 'contentGoal' };
  }
  return { archetype: 'analytical', source: 'default' };
}

// ── Stage 2/3 modifier tables ────────────────────────────────────────────────

const GOAL_MODIFIERS: Record<string, VoiceAdjustment> = {
  build_authority:   { label: 'goal:build_authority',   surface: { formality: 1 }, structural: { hedgeTolerance: 'high', counterArgumentMode: 'weave_required' } },
  educate_audience:  { label: 'goal:educate_audience',  structural: { argumentFlow: 'explainer_sequential', storytelling: 'seasoning' } },
  grow_community:    { label: 'goal:grow_community',    surface: { warmth: 1 }, structural: { closingDefault: 'audience_question' } },
  personal_branding: { label: 'goal:personal_branding', surface: { warmth: 1 }, structural: { storytelling: 'spine' }, addPreferredOpenings: ['personal_anecdote'] },
  generate_leads:    { label: 'goal:generate_leads',    surface: { boldness: 1 }, structural: { closingDefault: 'cta', counterArgumentMode: 'acknowledge_light' } },
  increase_sales:    { label: 'goal:increase_sales',    surface: { boldness: 1 }, structural: { closingDefault: 'cta' } },
};

function audienceModifiers(audience?: string | null): VoiceAdjustment[] {
  if (!audience) return [];
  const a = audience.toLowerCase();
  const out: VoiceAdjustment[] = [];
  if (/founder|startup/.test(a))                          out.push({ label: 'audience:founders',  surface: { boldness: 1 }, structural: { hedgeTolerance: 'low', paragraphRhythm: 'punchy' } });
  if (/exec|c-level|c-suite|cxo|enterprise/.test(a))      out.push({ label: 'audience:executive', surface: { formality: 1, warmth: -1 }, structural: { hedgeTolerance: 'high' } });
  if (/creator|marketer|influencer/.test(a))              out.push({ label: 'audience:creators',  surface: { warmth: 1 }, structural: { paragraphRhythm: 'punchy' } });
  if (/developer|engineer|technical/.test(a))             out.push({ label: 'audience:technical', surface: { humor: -1, warmth: -1 }, addPreferredOpenings: ['data_point'] });
  return out;
}

// ── Application + normalization ──────────────────────────────────────────────

function addPreferredOpening(draft: VoiceProfile, move: VoiceProfile['structural']['openingMoves']['preferred'][number]) {
  const om = draft.structural.openingMoves;
  if (!om.preferred.includes(move)) om.preferred.push(move);
  om.discouraged = om.discouraged.filter(m => m !== move);
}

// Apply one adjustment to the draft. Surface deltas are additive (clamped later);
// structural set-fields are last-write-wins (so later stages win on overlap).
function applyAdjustment(draft: VoiceProfile, adj: VoiceAdjustment, modifiers: string[]) {
  if (adj.surface) {
    const s = draft.surface as Record<string, number>;
    for (const [k, v] of Object.entries(adj.surface)) s[k] += v as number;
  }
  if (adj.structural) {
    const st = adj.structural;
    if (st.argumentFlow)        draft.structural.argumentFlow = st.argumentFlow;
    if (st.counterArgumentMode) draft.structural.counterArgumentMode = st.counterArgumentMode;
    if (st.hedgeTolerance)      draft.structural.hedgeTolerance = st.hedgeTolerance;
    if (st.storytelling)        draft.structural.storytelling = st.storytelling;
    if (st.paragraphRhythm)     draft.structural.paragraphRhythm = st.paragraphRhythm;
    if (st.closingDefault) {
      draft.structural.closingStyle.default = st.closingDefault;
      if (!draft.structural.closingStyle.preferred.includes(st.closingDefault)) {
        draft.structural.closingStyle.preferred.unshift(st.closingDefault);
      }
    }
  }
  if (adj.addPreferredOpenings) {
    for (const m of adj.addPreferredOpenings) addPreferredOpening(draft, m);
  }
  modifiers.push(adj.label);
}

const clampLevel = (n: number): number => Math.max(0, Math.min(4, Math.round(n)));

function normalize(draft: VoiceProfile) {
  const s = draft.surface as Record<string, number>;
  for (const k of Object.keys(s)) s[k] = clampLevel(s[k]);

  // The default opening must be in `preferred`; a preferred opening must not also
  // be discouraged (preferred wins).
  const om = draft.structural.openingMoves;
  if (!om.preferred.includes(om.default)) om.preferred.unshift(om.default);
  om.discouraged = om.discouraged.filter(m => !om.preferred.includes(m));
}

/**
 * Resolve a case's settings into a deterministic VoiceProfile.
 * Pure: no I/O, no LLM, no mutation of the input. Always schema-valid (throws only
 * on an internal catalog bug, never on user input).
 */
export function resolveVoiceProfile(input: VoiceCaseInput): VoiceProfile {
  const c = input;

  // Stage 1 — archetype.
  const { archetype, source } = selectArchetype(c);
  const base = ARCHETYPE_CATALOG[archetype];

  const draft: VoiceProfile = {
    archetype,
    // Deep clone catalog defaults (JSON-safe plain data) so the shared catalog is
    // never mutated across calls.
    surface:    JSON.parse(JSON.stringify(base.surface)),
    structural: JSON.parse(JSON.stringify(base.structural)),
    factFloor:  { ...FACT_FLOOR },
    meta: {
      resolverVersion:     RESOLVER_VERSION,
      archetypeSource:     source,
      appliedModifiers:    [],
      droppedInstructions: [],
    },
  };

  const modifiers: string[] = [];
  const dropped: string[] = [];

  // Stage 2 — goal modifiers.
  if (c.contentGoal && GOAL_MODIFIERS[c.contentGoal]) applyAdjustment(draft, GOAL_MODIFIERS[c.contentGoal], modifiers);

  // Stage 3 — audience modifiers.
  for (const adj of audienceModifiers(c.targetAudience)) applyAdjustment(draft, adj, modifiers);

  // Stage 4a — custom style/goal text (below aiInstructions in the ladder).
  const customText = [c.styleCustom, c.goalCustom].filter(Boolean).join('. ');
  const customParsed = parseInstructions(customText);
  for (const adj of customParsed.adjustments) applyAdjustment(draft, adj, modifiers);
  dropped.push(...customParsed.dropped);

  // Stage 4b — aiInstructions overrides (highest precedence on any field they touch).
  const aiParsed = parseInstructions(c.aiInstructions);
  for (const adj of aiParsed.adjustments) applyAdjustment(draft, adj, modifiers);
  dropped.push(...aiParsed.dropped);

  // Stage 5 — normalize + validate.
  draft.meta.appliedModifiers = modifiers;
  draft.meta.droppedInstructions = dropped;
  normalize(draft);

  return VoiceProfileSchema.parse(draft);
}
