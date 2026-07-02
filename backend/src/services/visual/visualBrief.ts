import type { ContentCase, ContentOutput } from '@prisma/client';
import { removeEmDashes } from '../outputSanitizer';
import { DEFAULT_LAYOUT, type AnchorId, type LabelPosition, type LayoutId } from './lumaiDesign';

// A composited label chip: the renderer annotates `text` NEAR the object's anchor zone,
// on the requested side (Sprint 6.2 relational placement), never pinned to a rigid pixel.
// The AI background stays text-free; all readable labels come from this overlay layer.
export interface LabelChip { text: string; anchor: AnchorId; position: LabelPosition }

export interface OverlaySpec {
  // Sprint 6 — two-tier text (Apple Minimal Editorial): a bold charcoal headline plus an
  // optional muted-grey supporting paragraph. `layout` picks the composition preset;
  // `labels` are composited over the visual. Headline colour is a fixed brand token
  // (charcoal on light), so there is no per-line accent any more.
  lines: string[];
  body: string | null;
  dir: 'ltr' | 'rtl';
  layout: LayoutId;
  labels: LabelChip[];
}
export interface VisualBrief {
  visualCategory: string;
  language: 'en' | 'he';
  overlay: OverlaySpec;
  // Whitelisted fields for the intent step (no CTA/hashtags/body).
  fields: { thesis?: string; reframe?: string; hook?: string; keyInsight?: string; title?: string; lang: string };
}

// Lightweight category classification (telemetry only — the INTENT drives
// the image). Deterministic keyword scan over title + goal; never an LLM call.
function classify(text: string): string {
  const t = text.toLowerCase();
  if (/\b(ai|model|inference|gpu|compute|llm|machine learning)\b/.test(t)) return 'ai_infrastructure';
  if (/\b(security|cyber|breach|attack|threat|ransomware|defense)\b/.test(t)) return 'cybersecurity';
  if (/\b(health|patient|clinical|medic|care|biotech|diagnos)\b/.test(t)) return 'healthcare';
  if (/\b(finance|capital|market|liquidity|invest|fund|risk|economic)\b/.test(t)) return 'finance';
  if (/\b(leader|leadership|team|culture|manage|clarity)\b/.test(t)) return 'leadership';
  return 'business_strategy';
}

// Semantic, balanced line wrapping. Sprint 3.1: this is the ONLY headline concern —
// choose good break points (≤ maxLines), prefer punctuation/phrase boundaries, balance
// line lengths, avoid orphan fragments. It NEVER reverses/reorders, NEVER truncates,
// NEVER adds "…". Final font sizing is the RENDERER's job (it pixel-fits the wrapped
// lines). Mixed tokens ("ה-AI"/"GPU"/"TSMC") are single words and never split.
const PUNCT_END = /[,.;:!?…]+$/;
// Used ONLY to choose how many lines look balanced — never as a truncation cap.
// (~≤26 → 1 line, ~27–52 → 2 lines, ~53+ → 3 lines; the renderer pixel-fits the font.)
const IDEAL_LINE_CHARS = 26;

function* combos(items: number[], k: number, start = 0): Generator<number[]> {
  if (k === 0) { yield []; return; }
  for (let i = start; i <= items.length - k; i++) {
    for (const rest of combos(items, k - 1, i + 1)) yield [items[i], ...rest];
  }
}

function partition(words: string[], cuts: number[]): string[][] {
  const idx = [0, ...cuts, words.length];
  const groups: string[][] = [];
  for (let i = 0; i < idx.length - 1; i++) groups.push(words.slice(idx[i], idx[i + 1]));
  return groups;
}

// Most balanced, phrase-aware partition of `words` into exactly L lines. No width cap,
// no truncation — always returns a partition (every word kept).
function bestPartition(words: string[], L: number): string[] {
  if (L >= words.length) return words.map(w => w); // one word per line (degenerate)
  const breakPositions = Array.from({ length: words.length - 1 }, (_, i) => i + 1);
  let best: string[] = [words.join(' ')];
  let bestScore = Infinity;
  for (const cut of combos(breakPositions, L - 1)) {
    const groups = partition(words, cut);
    const lens = groups.map(g => g.join(' ').length);
    let score = (Math.max(...lens) - Math.min(...lens)) + Math.max(...lens) * 0.1; // balance
    for (let i = 0; i < groups.length - 1; i++) if (PUNCT_END.test(groups[i].join(' '))) score -= 6; // phrase boundary
    for (const ln of lens) if (ln < 6) score += 8;          // avoid tiny orphan fragments
    const last = groups[groups.length - 1];
    if (last.length === 1 && last[0].replace(PUNCT_END, '').length <= 3) score += 10; // lone short function word
    if (score < bestScore) { bestScore = score; best = groups.map(g => g.join(' ')); }
  }
  return best;
}

export function wrapHeadline(text: string, maxLines = 3): string[] {
  const clean = removeEmDashes(text).replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= 1) return [clean];
  // Pick a line count by visual balance (never to truncate); renderer pixel-fits the font.
  const L = Math.min(maxLines, words.length, Math.max(1, Math.ceil(clean.length / IDEAL_LINE_CHARS)));
  if (L <= 1) return [clean];
  return bestPartition(words, L);
}

function readBreakdown(output: ContentOutput): Record<string, unknown> {
  const b = output.breakdown;
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
}

// RTL detection from the ACTUAL text (Hebrew block). Direction must follow the
// headline script, not just case.language — a Hebrew headline in a case mislabeled
// 'en' must still render RTL (the real-world source of "broken/reversed" Hebrew).
const RTL_RE = /[֐-׿]/;
export function isRtlText(s: string): boolean {
  return RTL_RE.test(s ?? '');
}

// Build a full two-tier OverlaySpec. Direction follows the headline's script (phrase-
// aware wrapping, never reversed). `body` is the optional supporting paragraph; `layout`
// and `labels` come from the visual plan. The renderer wraps `body` to the text column.
export function buildOverlay(
  headline: string,
  body: string | null = null,
  layout: LayoutId = DEFAULT_LAYOUT,
  labels: LabelChip[] = [],
): OverlaySpec {
  const rtl = isRtlText(headline);
  const clean = (body ?? '').replace(/\s+/g, ' ').trim();
  return { lines: wrapHeadline(headline, 3), body: clean || null, dir: rtl ? 'rtl' : 'ltr', layout, labels };
}

// Thin back-compat helper (headline-only overlay with brand defaults).
export function overlayFromHeadline(headline: string): OverlaySpec {
  return buildOverlay(headline);
}

export function buildVisualBrief(output: ContentOutput, caseItem: ContentCase): VisualBrief {
  const bd = readBreakdown(output);
  const hook = (typeof bd.hook === 'string' && bd.hook.trim()) ? bd.hook.trim() : output.title;
  const rtl = isRtlText(hook);
  const language: 'en' | 'he' = rtl ? 'he' : 'en';
  const category = classify(`${output.title} ${caseItem.contentGoal ?? ''} ${caseItem.title ?? ''}`);
  return {
    visualCategory: category,
    language,
    overlay: buildOverlay(hook), // headline-only default; the plan enriches it (body/layout/labels)
    fields: {
      thesis: typeof bd.insight === 'string' ? bd.insight : output.title,
      reframe: typeof bd.context === 'string' ? bd.context : undefined,
      hook,
      keyInsight: typeof bd.insight === 'string' ? bd.insight : undefined,
      title: output.title,
      lang: language,
    },
  };
}
