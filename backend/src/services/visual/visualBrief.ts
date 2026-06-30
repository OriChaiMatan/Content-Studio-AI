import type { ContentCase, ContentOutput } from '@prisma/client';
import { removeEmDashes } from '../outputSanitizer';

export interface OverlaySpec {
  kicker: string;
  lines: string[];
  emphasisLine: number;
  dir: 'ltr' | 'rtl';
}
export interface VisualBrief {
  visualCategory: string;
  language: 'en' | 'he';
  overlay: OverlaySpec;
  // Whitelisted fields for the intent step (no CTA/hashtags/body).
  fields: { thesis?: string; reframe?: string; hook?: string; keyInsight?: string; title?: string; lang: string };
}

const KICKER: Record<string, { en: string; he: string }> = {
  ai_infrastructure: { en: 'AI INFRASTRUCTURE', he: 'תשתיות AI' },
  cybersecurity:     { en: 'CYBERSECURITY',     he: 'אבטחת סייבר' },
  healthcare:        { en: 'HEALTHCARE',        he: 'חדשנות רפואית' },
  finance:           { en: 'FINANCIAL INTELLIGENCE', he: 'מודיעין פיננסי' },
  leadership:        { en: 'LEADERSHIP',        he: 'מנהיגות' },
  business_strategy: { en: 'BUSINESS STRATEGY', he: 'אסטרטגיה עסקית' },
};

// Lightweight category classification (telemetry/kicker only — the INTENT drives
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

// Phrase-aware, balanced line wrapping. NEVER reverses or reorders — it only chooses
// WHERE to break the logical word sequence. Prefers breaks after punctuation, balances
// line lengths, avoids orphan/fragment lines, caps at maxLines, and shortens an
// over-long headline (… ) rather than forcing awkward long lines. Mixed tokens like
// "ה-AI" / "GPU" / "TSMC" are single space-delimited words and are never split.
const PUNCT_END = /[,.;:!?…]+$/;

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

// Best balanced partition of `words` into exactly L lines, each <= maxChars; null if none.
function bestPartition(words: string[], L: number, maxChars: number): string[] | null {
  if (L > words.length) return null;
  const breakPositions = Array.from({ length: words.length - 1 }, (_, i) => i + 1);
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (const cut of combos(breakPositions, L - 1)) {
    const groups = partition(words, cut);
    const lens = groups.map(g => g.join(' ').length);
    if (Math.max(...lens) > maxChars) continue;            // hard width cap
    let score = (Math.max(...lens) - Math.min(...lens)) + Math.max(...lens) * 0.1; // balance
    for (let i = 0; i < groups.length - 1; i++) if (PUNCT_END.test(groups[i].join(' '))) score -= 6; // phrase boundary
    for (const ln of lens) if (ln < 6) score += 8;          // avoid tiny orphan fragments
    const last = groups[groups.length - 1];
    if (last.length === 1 && last[0].replace(PUNCT_END, '').length <= 3) score += 10; // lone short function word
    if (score < bestScore) { bestScore = score; best = groups.map(g => g.join(' ')); }
  }
  return best;
}

export function wrapHeadline(text: string, maxChars: number, maxLines = 3): string[] {
  const clean = removeEmDashes(text).replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= 1) return [clean];
  if (clean.length <= maxChars) return [clean];           // short enough for one line

  for (let L = 2; L <= maxLines; L++) {
    const part = bestPartition(words, L, maxChars);
    if (part) return part;                                 // fewest lines that fit, balanced
  }

  // Too long even at maxLines: shorten the headline (drop trailing words + …) rather
  // than forcing long awkward lines.
  let w = words.slice(0, 16);
  while (w.length > maxLines) {
    w = w.slice(0, -1);
    const part = bestPartition(w, maxLines, maxChars);
    if (part) { const li = part.length - 1; part[li] = part[li].replace(PUNCT_END, '') + '…'; return part; }
  }
  return [w.join(' ')];
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

export function buildVisualBrief(output: ContentOutput, caseItem: ContentCase): VisualBrief {
  const bd = readBreakdown(output);
  const hook = (typeof bd.hook === 'string' && bd.hook.trim()) ? bd.hook.trim() : output.title;
  const rtl = isRtlText(hook);
  const language: 'en' | 'he' = rtl ? 'he' : 'en';
  const category = classify(`${output.title} ${caseItem.contentGoal ?? ''} ${caseItem.title ?? ''}`);
  // Hebrew tolerates wider lines (clean 2-line split); English stays ~3 tight lines.
  const lines = wrapHeadline(hook, rtl ? 30 : 18, 3);
  return {
    visualCategory: category,
    language,
    overlay: {
      kicker: (KICKER[category] ?? KICKER.business_strategy)[language],
      lines,
      emphasisLine: Math.max(0, lines.length - 1),
      dir: rtl ? 'rtl' : 'ltr',
    },
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
