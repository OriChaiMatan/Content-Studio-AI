// ─────────────────────────────────────────────────────────────────────────────
// LumAI Design System (Sprint 6). The SINGLE source of truth for the LumAI visual
// language. Both the image-prompt builder and the HTML/CSS renderer import from here,
// so every generated visual shares the same art direction, palette, typography and
// composition grammar — that constancy is what makes a LumAI image recognizable.
//
// Fixed forever: Apple Minimal Editorial style, bright/soft high-key light, neutral
// low-saturation palette, extreme negative space. The ONLY things that vary per post
// are the metaphor, the 1–3 visual groups, the layout preset and the background family.
//
// Phase 1 ships SOFT_STUDIO only. SOFT_ENVIRONMENT / ABSTRACT_DEPTH are declared for
// forward-compat but are NOT active yet (see ACTIVE_FAMILIES).
// ─────────────────────────────────────────────────────────────────────────────

export const DESIGN_VERSION = 'lumai-1';

// ── Background families ─────────────────────────────────────────────────────────
export const BACKGROUND_FAMILIES = ['SOFT_STUDIO', 'SOFT_ENVIRONMENT', 'ABSTRACT_DEPTH'] as const;
export type BackgroundFamily = (typeof BACKGROUND_FAMILIES)[number];
// Phase 1: only SOFT_STUDIO is buildable. The planner clamps any other choice to this.
export const ACTIVE_FAMILIES: readonly BackgroundFamily[] = ['SOFT_STUDIO'];
export const DEFAULT_FAMILY: BackgroundFamily = 'SOFT_STUDIO';

// ── Layout presets ──────────────────────────────────────────────────────────────
// The name refers to where the VISUAL MASS sits. The text zone occupies the opposite
// side (or the reading-start side for CENTER_BALANCED). Text-zone side is a LAYOUT
// decision, independent of RTL — RTL only controls alignment WITHIN the zone.
export const LAYOUTS = ['LEFT_HEAVY', 'CENTER_BALANCED', 'RIGHT_HEAVY'] as const;
export type LayoutId = (typeof LAYOUTS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'RIGHT_HEAVY';

// ── Anchors ─────────────────────────────────────────────────────────────────────
// Named zones the model is told to place a visual group into, and where the renderer
// draws that group's label chip. Coordinates are fractions of the frame (0..1).
export const ANCHORS = ['VISUAL_MAIN', 'VISUAL_SECONDARY', 'VISUAL_ACCENT'] as const;
export type AnchorId = (typeof ANCHORS)[number];

// Sprint 6.2 — relational label placement. A chip is annotated NEAR its object's anchor
// zone (Apple-style), on the requested side, instead of pinned to a rigid coordinate.
export const LABEL_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
export type LabelPosition = (typeof LABEL_POSITIONS)[number];
export function isValidLabelPosition(p: string): p is LabelPosition {
  return (LABEL_POSITIONS as readonly string[]).includes(p);
}

export interface LayoutPreset {
  textZoneSide: 'left' | 'right' | 'start'; // 'start' = reading-start (rtl→right, ltr→left)
  textZoneWidthPct: number;                 // width of the text zone as % of frame width
  visualSide: 'left' | 'right' | 'center';  // where the visual mass sits (for prompt copy)
  anchors: Record<AnchorId, { x: number; y: number }>;
}

export const LAYOUT_PRESETS: Record<LayoutId, LayoutPreset> = {
  RIGHT_HEAVY: {
    textZoneSide: 'left', textZoneWidthPct: 40, visualSide: 'right',
    anchors: { VISUAL_MAIN: { x: 0.72, y: 0.52 }, VISUAL_SECONDARY: { x: 0.54, y: 0.44 }, VISUAL_ACCENT: { x: 0.85, y: 0.40 } },
  },
  LEFT_HEAVY: {
    textZoneSide: 'right', textZoneWidthPct: 40, visualSide: 'left',
    anchors: { VISUAL_MAIN: { x: 0.30, y: 0.52 }, VISUAL_SECONDARY: { x: 0.46, y: 0.44 }, VISUAL_ACCENT: { x: 0.16, y: 0.40 } },
  },
  CENTER_BALANCED: {
    textZoneSide: 'start', textZoneWidthPct: 36, visualSide: 'center',
    anchors: { VISUAL_MAIN: { x: 0.55, y: 0.54 }, VISUAL_SECONDARY: { x: 0.68, y: 0.44 }, VISUAL_ACCENT: { x: 0.42, y: 0.44 } },
  },
};

export function isValidAnchor(a: string): a is AnchorId {
  return (ANCHORS as readonly string[]).includes(a);
}

// Resolve concrete text/visual sides for a layout given the headline's reading direction.
export function resolveSides(layout: LayoutId, rtl: boolean): { textSide: 'left' | 'right'; visualSide: 'left' | 'right' | 'center' } {
  const p = LAYOUT_PRESETS[layout];
  const textSide = p.textZoneSide === 'start' ? (rtl ? 'right' : 'left') : p.textZoneSide;
  return { textSide, visualSide: p.visualSide };
}

// Human-readable placement phrases for the prompt (the model places the object here;
// WE overlay the label — the background itself stays text-free).
export const ANCHOR_REGION: Record<AnchorId, string> = {
  VISUAL_MAIN: 'the primary focal position',
  VISUAL_SECONDARY: 'just beside the main subject',
  VISUAL_ACCENT: 'a small secondary accent position',
};

// ── Palette & typography tokens (read off the golden reference; confirm on render) ──
export const PALETTE = {
  ground: '#FFFFFF',      // clean pure-white studio sweep (Sprint 10 — no more warm beige)
  anchor: '#000000',      // pure black — headline
  body: '#7A808A',        // lighter grey — supporting paragraph (secondary to headline)
  accent: '#E53935',      // single red accent — sparing emphasis
  divider: '#E3E3E5',
  chipBg: 'rgba(255,255,255,0.88)',
  chipBorder: 'rgba(23,25,28,0.10)',
  chipText: '#20242A',
} as const;

export const TYPO = {
  family: "'Brand',sans-serif",
  headlineWeight: 900,          // extra bold
  headlineTracking: '-0.03em',  // Sprint 10 — tighter kerning
  headlineSizePx: 72,           // Sprint 10 — larger, stronger dominance (auto-fits down)
  headlineMinPx: 32,
  headlineLineHeight: 1.0,       // tight editorial leading
  bodyWeight: 400,               // lighter — secondary to headline
  bodySizePx: 22,                // smaller
  bodyLineHeight: 1.5,
  accentBarPx: 4,                // red accent underline thickness
  chipSizePx: 19,
  chipWeight: 600,
} as const;

// ── Fixed art-direction preamble (Apple Minimal Editorial × premium 3D render) ──
// Constant on EVERY prompt. Kept tight so the whole prompt stays < 900 chars.
// NOTE: never name real brands here — gpt-image-1 will render their logos. Describe the
// AESTHETIC only. (Brand references belong in the Claude planner/critic prompts, not this.)
export const ART_DIRECTION =
  'LumAI editorial visual — premium minimal editorial, keynote-grade 3D render. ONE inevitable visual idea on a clean bright PURE-WHITE studio sweep: crisp high-key light, one soft shadow, strong negative space, matte premium materials, high contrast. Not illustration, not stock photo, not AI art, not sci-fi.';

export const FAMILY_DIRECTIVE: Record<BackgroundFamily, string> = {
  SOFT_STUDIO: 'Background: a clean bright pure-white seamless studio sweep — no room, no scenery.',
  // Not active in Phase 1 — placeholders so the type is total.
  SOFT_ENVIRONMENT: 'Background: a soft, bright real-world setting kept far out of focus.',
  ABSTRACT_DEPTH: 'Background: a soft abstract gradient of layered depth.',
};

// Fixed negative tail — short and non-contradictory (long cliché lists live in the critic).
export const NEGATIVE_TAIL =
  'No text, letters, numbers, logos or signage on any surface. Not busy, not cluttered, not literal.';
