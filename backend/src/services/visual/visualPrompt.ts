import { isRtlText } from './visualBrief';
import type { VisualPlan } from './visualIntelligence';
import { ART_DIRECTION, FAMILY_DIRECTIVE, NEGATIVE_TAIL, resolveSides } from './lumaiDesign';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic image-prompt builder. Claude decides the visual argument (VisualPlan);
// this file formats the gpt-image-1 prompt from FIXED LumAI design-system constants
// (art direction, family directive, negatives) plus a small variable slot (the physical-
// analogy SCENE + 1–3 objects). ~70% of the string is constant, which is what makes every
// LumAI image look related.
//
// The background stays strictly TEXT-FREE — labels are composited by the renderer.
// Guaranteed < 900 chars.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PROMPT = 900;
// Sprint 9 — reinforce the chosen visual grammar in the image prompt.
const GRAMMAR_HINT: Record<string, string> = {
  object: 'one strong subject carries the whole idea',
  relationship: 'show TWO distinct subjects in relation, not one object',
  system: 'show a repeating process or loop, not a static state',
};

function clipWords(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.lastIndexOf(' ', n);
  return s.slice(0, cut > 0 ? cut : n).trim();
}

export function buildImagePrompt(plan: VisualPlan): string {
  const rtl = isRtlText(plan.headline);
  const { textSide, visualSide } = resolveSides(plan.layout, rtl);
  const family = FAMILY_DIRECTIVE[plan.backgroundFamily] ?? FAMILY_DIRECTIVE.SOFT_STUDIO;
  const people = plan.allowHumans
    ? ' Any people must be secondary and non-identifiable.'
    : ' No people.';

  // Mutable copies of the variable-length fields (whitespace-normalized). Anchors are
  // NOT spelled out in the prompt (gpt-image-1 ignores fine placement anyway) — they
  // drive the renderer's chip placement. The ONE IDEA is the physical-analogy scene.
  let scene = plan.scene.replace(/\s+/g, ' ').trim();
  const groups = plan.visualGroups.map(g => ({ d: g.description.replace(/\s+/g, ' ').trim() }));

  const grammar = GRAMMAR_HINT[plan.visualGrammar] ?? GRAMMAR_HINT.object;
  const assemble = (): string => `${ART_DIRECTION}
${family}

ONE IDEA: ${scene}
GRAMMAR (${plan.visualGrammar}): ${grammar}.
COMPOSITION ${plan.layout}: visual mass on the ${visualSide}; keep the ${textSide} ~40% clear for the headline.
SUBJECTS (max 3, blank & text-free): ${groups.map(g => g.d).join('; ')}
${NEGATIVE_TAIL}${people}`;

  let out = assemble();

  // Safety net: keep the final string < 900 chars. Priority — NEVER trim the scene (it
  // carries the visual trick) until every lower-priority subject description has been
  // trimmed first. The fixed art direction / grammar / render instructions are never trimmed.
  let guard = 0;
  while (out.length >= MAX_PROMPT && guard++ < 80) {
    const longest = groups.reduce((a, b) => (b.d.length > a.d.length ? b : a), groups[0]);
    if (longest && longest.d.length > 24) {
      longest.d = clipWords(longest.d, Math.floor(longest.d.length * 0.85));
    } else if (scene.length > 60) {           // last resort only
      scene = clipWords(scene, Math.floor(scene.length * 0.85));
    } else {
      break;
    }
    out = assemble();
  }
  return out;
}

// Local debugging only (never exposed to users). Gate any logging behind VISUAL_DEBUG.
export function visualDebug(plan: VisualPlan, prompt: string): { plan: VisualPlan; prompt: string; promptLength: number } {
  return { plan, prompt, promptLength: prompt.length };
}
