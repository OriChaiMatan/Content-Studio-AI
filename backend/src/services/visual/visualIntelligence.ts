import { getAnthropicClient, sourceAnalysisConfig } from '../../lib/anthropic';
import { removeEmDashes } from '../outputSanitizer';
import type { VisualBrief } from './visualBrief';
import {
  ACTIVE_FAMILIES, ANCHORS, BACKGROUND_FAMILIES, DEFAULT_FAMILY, DEFAULT_LAYOUT, LAYOUTS,
  isValidAnchor, isValidLabelPosition, type AnchorId, type BackgroundFamily, type LabelPosition, type LayoutId,
} from './lumaiDesign';

// ─────────────────────────────────────────────────────────────────────────────
// Visual Intelligence — LEAN Creative Director (Sprint 10). The planner is LOCKED:
// a single Claude pass that picks the strongest INEVITABLE visual concept and writes
// English editorial copy. Taste is no longer simulated from text — the heavy text-side
// proxy quality logic (frame-strength regex, mechanism-stress regex, stop-scroll/label
// heuristics, per-word gates) has been DELETED. Actual quality is judged on the rendered
// PIXELS downstream (best-of-N + a Claude-vision Render Critic in visualAssetService).
//
// Only minimal pre-generation safeguards remain: cliché rejection, grammar consistency,
// and basic thesis/headline sanity — just enough to avoid wasting generations.
// ─────────────────────────────────────────────────────────────────────────────

export const VISUAL_GRAMMARS = ['object', 'relationship', 'system'] as const;
export type VisualGrammar = (typeof VISUAL_GRAMMARS)[number];

export interface VisualGroup {
  description: string;
  label: string | null;         // OPTIONAL English label (default none — the critic decides if it helps)
  labelPosition: LabelPosition;
  anchor: AnchorId;
}

export interface VisualPlan {
  thesis: string;
  mechanism: string;
  visualGrammar: VisualGrammar;
  scene: string;                 // the strongest inevitable image, as a premium 3D still
  visualGroups: VisualGroup[];   // 1–3 objects (relationship ⇒ ≥ 2); labels default NONE
  backgroundFamily: BackgroundFamily;
  layout: LayoutId;
  allowHumans: boolean;
  headline: string;              // English editorial headline
  supportingLine: string | null; // English 2–4 line paragraph, ≤ 32 words
  source: string;                // 'claude' | 'claude:retry' | 'fallback:*'
}

// ── Minimal pre-generation safeguards (kept) ──────────────────────────────────
const CLICHE = /\b(soldiers?|battles?|warfare|fortress(es)?|castles?|lighthouses?|robot faces?|neon cit(y|ies)|circuit[\s-]?boards?|glowing eyes|sci-?fi wallpaper|knights?|swords?)\b/i;
const WEAK_ANALOGY = /\b(scales?|balance beams?|see-?saws?|chess|arrows?|shields?|funnels?|light[\s-]?bulbs?|lightbulbs?|stacked blocks?|bar charts?|pie charts?|gears?)\b/i;
const TOPIC_CLICHE = /\b(calendars?|clocks?|stopwatch(es)?|wall clock|cubicles?|handshakes?|stock photo|generic (dashboard|saas|ui|app|interface|screen)|office worker|briefcases?)\b/i;
const PROCESS_RE = /\b(loop|cycle|belt|conveyor|treadmill|ratchet|escalator|refill|reload|again|repeat|repeating|feeds?|circulat|spiral|rotat|endless|continuous|feedback|pipeline|flow)\b/i;

function sceneBlob(p: VisualPlan): string {
  return `${p.scene} ${p.visualGroups.map(g => g.description).join(' ')}`;
}
export function isCliche(p: VisualPlan): boolean {
  const b = sceneBlob(p);
  return CLICHE.test(b) || WEAK_ANALOGY.test(b) || TOPIC_CLICHE.test(b);
}
export function grammarConsistent(p: VisualPlan): boolean {
  if (p.visualGrammar === 'relationship') return p.visualGroups.length >= 2;
  if (p.visualGrammar === 'system') return PROCESS_RE.test(sceneBlob(p));
  return p.visualGroups.length >= 1;
}
export function labelCount(p: VisualPlan): number {
  return p.visualGroups.filter(g => g.label && g.label.trim()).length;
}
// The ONLY pre-gen gate: not cliché, grammar-consistent, basic thesis/headline sanity.
export function passesInvariants(p: VisualPlan): boolean {
  if (isCliche(p)) return false;
  if (!grammarConsistent(p)) return false;
  if (!p.thesis.trim() || !p.headline.trim()) return false;
  return true;
}

const HUMAN_OK = /\b(leader|leadership|manager?s?|managing|team|hir(e|ing)|recruit|talent|employ|workforce|psycholog|behaviou?r|emotion|culture|interpersonal|customers?|consumers?|clients?|negotiat|empathy|mentor|coach)\b/i;
export function humansAllowed(domain: string, text: string): boolean {
  return domain === 'leadership' || HUMAN_OK.test(text ?? '');
}

function clampHeadline(s: string): string {
  const w = removeEmDashes(s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return w.length > 8 ? w.slice(0, 8).join(' ') : w.join(' ');
}
function clampParagraph(s: string): string {
  const clean = removeEmDashes(s).replace(/\s+/g, ' ').trim();
  if (clean.split(' ').filter(Boolean).length <= 32) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = ''; let words = 0;
  for (const sent of sentences) {
    const n = sent.trim().split(/\s+/).filter(Boolean).length;
    if (out && words + n > 32) break;
    out += sent; words += n;
    if (words >= 32) break;
  }
  return out.trim() || clean.split(' ').slice(0, 32).join(' ');
}
// Text Minimalism — keep at most 2 labels, each ≤ 2 words; everything else → null.
function enforceLabelDiscipline(groups: VisualGroup[]): VisualGroup[] {
  let kept = 0;
  return groups.map(g => {
    if (!g.label || !g.label.trim()) return { ...g, label: null };
    const words = g.label.trim().split(/\s+/).filter(Boolean);
    if (words.length > 2 || kept >= 2) return { ...g, label: null };
    kept += 1;
    return { ...g, label: g.label.trim() };
  });
}
function chooseFallbackHeadline(fields: VisualBrief['fields']): string {
  const title = removeEmDashes(fields.title || '').replace(/\s+/g, ' ').trim();
  const n = title.split(' ').filter(Boolean).length;
  if (title && n >= 2 && n <= 8 && !/[֐-׿]/.test(title)) return clampHeadline(title);
  return 'The Real Trade-Off';
}

// MINIMAL safe plan — the ONLY fallback (LLM unavailable/unparseable). No templates.
export function deterministicPlan(fields: VisualBrief['fields'], domain: string, reason = 'fallback'): VisualPlan {
  const blob = `${fields.thesis ?? ''} ${fields.hook ?? ''} ${fields.title ?? ''}`;
  return {
    thesis: (fields.thesis || fields.title || '').replace(/\s+/g, ' ').trim() || 'A specific, non-obvious tension in this topic.',
    mechanism: 'the visible surface conceals the real force underneath',
    visualGrammar: 'object',
    scene: 'a single premium matte object tipping off-balance on a clean bright white studio sweep, one soft shadow, generous negative space',
    visualGroups: [{ description: 'one premium matte object tipping off-balance on white', label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' }],
    backgroundFamily: DEFAULT_FAMILY,
    layout: DEFAULT_LAYOUT,
    allowHumans: humansAllowed(domain, blob),
    headline: chooseFallbackHeadline(fields),
    supportingLine: null,
    source: `fallback:${reason}`,
  };
}

// ── Claude call ─────────────────────────────────────────────────────────────

const SYSTEM = `You are the creative director for LumAI — Apple / Stripe / OpenAI editorial quality. For a post in ANY language, produce ONE inevitable editorial image concept plus its ENGLISH copy. Output ONLY JSON. Commit like a director.

The one question: "Which image feels INEVITABLE once seen?" — not merely correct, not logical, INEVITABLE. Show the MECHANISM with real tension / asymmetry / surprise. NEVER the topic, NEVER a symptom, NEVER a cliché (no scales, funnels, arrows, gears, blocks, charts, light bulbs, calendars, clocks, dashboards, stock office). A correct-but-boring image is a FAILURE.

STEP 1 — THESIS: the real argument.
STEP 2 — MECHANISM: in one sentence, the process/relationship that makes it true.
STEP 3 — VISUAL GRAMMAR (pick ONE): "object" (one object carries it), "relationship" (contrast/asymmetry between TWO things — give ≥2 groups), "system" (a loop/feedback/repeating process — show it repeating).
STEP 4 — SCENE: the STRONGEST frame as ONE concrete PREMIUM 3D still on a clean bright pure-white studio sweep, with VISIBLE tension/consequence (12–24 words). Prefer the frame with the most tension/asymmetry/surprise (a glass that looks full but has a false bottom; a tiny trigger causing a huge collapse; the weak side crumbling) over the cleanest one.
TEXT MINIMALISM: the image must explain ITSELF. DEFAULT no scene labels — every object BLANK/text-free. Labels ONLY if the thesis needs asymmetric naming: max 2, ≤2 words each.

visualGroups: 1–3 objects, each {description, label (null by default; ≤2 words), labelPosition ("left"|"right"|"top"|"bottom"), anchor ("VISUAL_MAIN"|"VISUAL_SECONDARY"|"VISUAL_ACCENT")}. relationship ⇒ ≥2 groups. Objects BLANK/text-free.
layout ("LEFT_HEAVY"|"CENTER_BALANCED"|"RIGHT_HEAVY"); allowHumans (false unless the thesis is about human dynamics).

EDITORIAL COPY — ENGLISH ONLY, never copied; DISTILL the thesis (Apple/Stripe/OpenAI voice):
- headline: 3–8 words, extra-bold, punchy, emotionally sharp.
- supportingParagraph: 2–4 short lines, ≤ 32 words, compressed — never verbose/academic.

LENGTH DISCIPLINE: mechanism ≤ 16 words; scene ≤ 24 words; each group description ≤ 12 words.

Return ONLY this JSON (no prose, no code fences):
{"thesis":string,"mechanism":string,"visualGrammar":"object"|"relationship"|"system","scene":string,"visualGroups":[{"description":string,"label":string|null,"labelPosition":"left"|"right"|"top"|"bottom","anchor":"VISUAL_MAIN"|"VISUAL_SECONDARY"|"VISUAL_ACCENT"}],"backgroundFamily":"SOFT_STUDIO","layout":"LEFT_HEAVY"|"CENTER_BALANCED"|"RIGHT_HEAVY","allowHumans":boolean,"headline":string,"supportingParagraph":string}`;

const RETRY_NOTE = 'That was cliché or broke its grammar. Redo: show the MECHANISM as an INEVITABLE image with real tension/asymmetry (not the topic, not a symptom, not a cliché). Correct the grammar (relationship ⇒ two elements; system ⇒ a loop). English copy only.';

// Passed by visualAssetService when the Render Critic rejects ALL rendered candidates.
export const REFRAME_NOTE = 'The previous concepts were CORRECT BUT BORING — safe, generic, too literal. Find a STRONGER, more INEVITABLE visual with far more tension, asymmetry, or surprise (an illusion vs reality, a tiny trigger causing a massive consequence, a collapse). It must be impossible to ignore and worthy of Apple/Stripe/OpenAI editorial publishing.';

function parseJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>; } catch { return null; }
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function coerceGroups(raw: unknown, fb: VisualGroup[]): VisualGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return fb;
  const groups = raw.slice(0, 3).map((g, i): VisualGroup => {
    const o = (g ?? {}) as Record<string, unknown>;
    const anchor: AnchorId = isValidAnchor(String(o.anchor)) ? o.anchor as AnchorId : ANCHORS[Math.min(i, ANCHORS.length - 1)];
    const labelPosition: LabelPosition = isValidLabelPosition(String(o.labelPosition)) ? o.labelPosition as LabelPosition : 'top';
    const label = str(o.label);
    return { description: str(o.description, 'a single premium object in soft studio light'), label: label || null, labelPosition, anchor };
  });
  return groups.length ? groups : fb;
}

function coercePlan(json: Record<string, unknown>, fb: VisualPlan, source: string): VisualPlan {
  const rawBg = String(json.backgroundFamily);
  const bgFamily: BackgroundFamily = (BACKGROUND_FAMILIES as readonly string[]).includes(rawBg) && ACTIVE_FAMILIES.includes(rawBg as BackgroundFamily)
    ? rawBg as BackgroundFamily : DEFAULT_FAMILY;
  const grammar: VisualGrammar = (VISUAL_GRAMMARS as readonly string[]).includes(String(json.visualGrammar)) ? json.visualGrammar as VisualGrammar : fb.visualGrammar;
  const paragraph = str(json.supportingParagraph) || str(json.supportingLine);
  return {
    thesis: str(json.thesis, fb.thesis),
    mechanism: str(json.mechanism, fb.mechanism),
    visualGrammar: grammar,
    scene: str(json.scene, fb.scene),
    visualGroups: enforceLabelDiscipline(coerceGroups(json.visualGroups, fb.visualGroups)),
    backgroundFamily: bgFamily,
    layout: (LAYOUTS as readonly string[]).includes(String(json.layout)) ? json.layout as LayoutId : fb.layout,
    allowHumans: json.allowHumans === true,
    headline: clampHeadline(str(json.headline, fb.headline)),
    supportingLine: paragraph ? clampParagraph(paragraph) : null,
    source,
  };
}

export async function analyzeVisual(
  fields: VisualBrief['fields'],
  domain: string,
  opts: { reframeNote?: string } = {},
): Promise<VisualPlan> {
  const client = getAnthropicClient();
  if (!client) return deterministicPlan(fields, domain, 'no-client');

  const base = [
    fields.thesis && `Thesis: ${fields.thesis}`,
    fields.reframe && `Angle: ${fields.reframe}`,
    fields.hook && `Hook: ${fields.hook}`,
    fields.keyInsight && `Key insight: ${fields.keyInsight}`,
    fields.title && `Title: ${fields.title}`,
    `Domain: ${domain}`,
    `Post language: ${fields.lang} (editorial copy MUST be English)`,
    'Return the LumAI visual PLAN as JSON only.',
  ].filter(Boolean).join('\n');
  const userMsg = opts.reframeNote ? `${base}\n\n${opts.reframeNote}` : base;

  // One committed pass; regenerate ONCE only if a minimal safeguard fails; then accept best.
  let note = '';
  let last: VisualPlan | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await client.messages.create({
        model: sourceAnalysisConfig.model,
        max_tokens: 1100,
        system: SYSTEM,
        messages: [{ role: 'user', content: note ? `${userMsg}\n\n${note}` : userMsg }],
      });
      const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ');
      const json = parseJson(text);
      if (json) {
        const plan = coercePlan(json, deterministicPlan(fields, domain, 'partial'), attempt === 0 ? 'claude' : 'claude:retry');
        last = plan;
        if (passesInvariants(plan)) return plan;
      }
    } catch {
      return deterministicPlan(fields, domain, 'error');
    }
    note = RETRY_NOTE;
  }
  return last ?? deterministicPlan(fields, domain, 'quality');
}
