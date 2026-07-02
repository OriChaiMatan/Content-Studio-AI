import { LAYOUT_PRESETS, resolveSides, TYPO, type AnchorId, type LayoutId, type LabelPosition } from './lumaiDesign';

// ─────────────────────────────────────────────────────────────────────────────
// Anchor-safe label geometry (Sprint 6.2). PURE, deterministic, browser-free so it is
// unit-testable. Labels are annotations placed NEAR an object's anchor zone (not pinned
// on it), on the requested side, with hard guarantees:
//   • never overlap the headline text zone
//   • never overlap each other
//   • never leave the frame
//   • if no safe placement exists, the chip is OMITTED (show=false) rather than drawn badly
// Chip width is estimated from text length (good enough for collision — chips are short).
// ─────────────────────────────────────────────────────────────────────────────

export interface LabelInput { text: string; anchor: AnchorId; position: LabelPosition }
export interface PlacedLabel { text: string; cxPct: number; cyPct: number; show: boolean }

interface Rect { l: number; t: number; w: number; h: number }

const FRAME_PAD = 14;   // keep chips off the very edge
const GAP = 10;         // min gap between a chip and the text zone / other chips
const OFF_X_FRAC = 0.13; // horizontal offset from anchor centre to chip centre
const OFF_Y_FRAC = 0.12; // vertical offset

// Rough chip box from its text (mirrors the renderer's chip CSS: font size + 14/8 padding).
function chipSize(text: string): { w: number; h: number } {
  const fp = TYPO.chipSizePx;
  const w = Math.ceil(text.length * fp * 0.60) + 2 * 14;
  const h = fp + 2 * 8;
  return { w, h };
}

function intersects(a: Rect, b: Rect, gap = 0): boolean {
  return !(a.l + a.w + gap <= b.l || b.l + b.w + gap <= a.l || a.t + a.h + gap <= b.t || b.t + b.h + gap <= a.t);
}

// The headline text zone as a pixel rect (labels must never touch it).
export function textZoneRect(layout: LayoutId, rtl: boolean, W: number, H: number): Rect {
  const preset = LAYOUT_PRESETS[layout] ?? LAYOUT_PRESETS.RIGHT_HEAVY;
  const { textSide } = resolveSides(layout, rtl);
  const w = (preset.textZoneWidthPct / 100) * W;
  return { l: textSide === 'left' ? 0 : W - w, t: 0, w, h: H };
}

function centreFor(pos: LabelPosition, ax: number, ay: number, W: number, H: number): { cx: number; cy: number } {
  const ox = OFF_X_FRAC * W, oy = OFF_Y_FRAC * H;
  switch (pos) {
    case 'left': return { cx: ax - ox, cy: ay };
    case 'right': return { cx: ax + ox, cy: ay };
    case 'top': return { cx: ax, cy: ay - oy };
    case 'bottom': return { cx: ax, cy: ay + oy };
  }
}

function rectAround(cx: number, cy: number, w: number, h: number): Rect {
  return { l: cx - w / 2, t: cy - h / 2, w, h };
}

function inFrame(r: Rect, W: number, H: number): boolean {
  return r.l >= FRAME_PAD && r.t >= FRAME_PAD && r.l + r.w <= W - FRAME_PAD && r.t + r.h <= H - FRAME_PAD;
}

// Place every label. Higher-priority anchors (MAIN → SECONDARY → ACCENT) are placed first
// so the most important chip wins the space; later chips that cannot avoid a collision are
// omitted. Candidate side order = requested first, then the rest.
const ANCHOR_PRIORITY: Record<AnchorId, number> = { VISUAL_MAIN: 0, VISUAL_SECONDARY: 1, VISUAL_ACCENT: 2 };
const ALL_POS: LabelPosition[] = ['top', 'bottom', 'left', 'right'];

export function placeLabels(labels: LabelInput[], layout: LayoutId, rtl: boolean, W: number, H: number): PlacedLabel[] {
  const preset = LAYOUT_PRESETS[layout] ?? LAYOUT_PRESETS.RIGHT_HEAVY;
  const zone = textZoneRect(layout, rtl, W, H);
  const placed: Rect[] = [];

  // Preserve the caller's order in the output, but resolve placement by anchor priority.
  const order = labels.map((l, i) => ({ l, i })).sort((a, b) => ANCHOR_PRIORITY[a.l.anchor] - ANCHOR_PRIORITY[b.l.anchor]);
  const out: PlacedLabel[] = labels.map(l => ({ text: l.text, cxPct: 0, cyPct: 0, show: false }));

  for (const { l, i } of order) {
    const a = preset.anchors[l.anchor] ?? preset.anchors.VISUAL_MAIN;
    const ax = a.x * W, ay = a.y * H;
    const { w, h } = chipSize(l.text);
    const candidates: LabelPosition[] = [l.position, ...ALL_POS.filter(p => p !== l.position)];
    for (const pos of candidates) {
      const { cx, cy } = centreFor(pos, ax, ay, W, H);
      const r = rectAround(cx, cy, w, h);
      if (!inFrame(r, W, H)) continue;
      if (intersects(r, zone, GAP)) continue;
      if (placed.some(p => intersects(r, p, GAP))) continue;
      out[i] = { text: l.text, cxPct: (cx / W) * 100, cyPct: (cy / H) * 100, show: true };
      placed.push(r);
      break;
    }
  }
  return out;
}
