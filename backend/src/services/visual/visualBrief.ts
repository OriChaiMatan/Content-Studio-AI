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

// Split a short headline string into <=3 visually balanced lines (greedy by length).
function toLines(text: string, maxLines = 3, perLine = 18): string[] {
  const words = removeEmDashes(text).replace(/\s+/g, ' ').trim().split(' ').slice(0, 12);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > perLine && lines.length < maxLines - 1) { lines.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function readBreakdown(output: ContentOutput): Record<string, unknown> {
  const b = output.breakdown;
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
}

export function buildVisualBrief(output: ContentOutput, caseItem: ContentCase): VisualBrief {
  const bd = readBreakdown(output);
  const language = (caseItem.language === 'he' ? 'he' : 'en') as 'en' | 'he';
  const hook = (typeof bd.hook === 'string' && bd.hook.trim()) ? bd.hook.trim() : output.title;
  const category = classify(`${output.title} ${caseItem.contentGoal ?? ''} ${caseItem.title ?? ''}`);
  const lines = toLines(hook);
  return {
    visualCategory: category,
    language,
    overlay: {
      kicker: (KICKER[category] ?? KICKER.business_strategy)[language],
      lines,
      emphasisLine: Math.max(0, lines.length - 1),
      dir: language === 'he' ? 'rtl' : 'ltr',
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
