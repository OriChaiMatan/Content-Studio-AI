import type { GeneratorInput, GeneratedOutput, ThesisPreservation } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Thesis Preservation Score (Phase 10E.2)
//
// Deterministic, post-generation measurement (NO extra Claude call) of how much
// of the WINNING thesis (primaryAngle) survives into the final content. Six
// dimensions, weighted to 100. Computed from the stored primaryAngle + the
// generated readyToPublish; works for en/he (bilingual marker sets). A low score
// on a claude-gen-1 output flags Research→Content flattening; a mock fallback
// naturally scores low (it ignores the thesis).
// ─────────────────────────────────────────────────────────────────────────────

const EN_STOP = new Set(['the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','were','be','been','being','that','this','these','those','it','its','as','at','by','from','into','than','then','not','no','may','will','would','could','should','can','has','have','had','do','does','did','about','their','they','them','our','your','his','her','which','who','what','when','where','how','why','more','most','less','very','also','such','only','same','other','one','two','first','second','their','there','our']);
const HE_STOP = new Set(['של','עם','על','את','כי','אבל','או','גם','הוא','היא','הם','הן','זה','זו','אינו','אינה','כל','יותר','אולי','עשוי','עשויה','אל','כמו','בין','הזה','הזו','אשר','כך','רק','עוד','כדי']);

function tokens(s: string): string[] {
  return (s || '').toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function contentTerms(s: string): string[] {
  return tokens(s).filter(w => w.length >= 3 && !EN_STOP.has(w) && !HE_STOP.has(w));
}
const uniq = (a: string[]) => [...new Set(a)];
function overlapFrac(terms: string[], hay: Set<string>): number {
  if (!terms.length) return 0;
  return terms.filter(t => hay.has(t)).length / terms.length;
}

// Cross-language regexes (English + Hebrew) for the qualitative dimensions.
const CONTRAST = /(isn'?t|not just|not merely|rather than|the real (story|question|issue)|may not be|not a |but a |paradox|trap|tension|the wrong|הסיפור האמיתי|אינו |אינה |לא ש|דווקא|פרדוקס|מתח|הבעיה האמיתית)/i;
const HEDGE = /(\bmay\b|\bmight\b|\bcould\b|appears|suggests|early signs|one possible|an emerging|likely|tends to|עשוי|עשויה|ייתכן|אולי|כנראה|נראה|מצביע|עשויים)/i;
const INTERP = /(because|therefore|which means|the implication|this suggests|reveals|exposes|the real|paradox|trap|tension|self-reinforcing|not\s+\w+\s+but|כי |לכן|מה שמוביל|המשמעות|חושף|מגלה|הסיפור האמיתי|פרדוקס|מתח|דווקא|מה ש)/gi;

/** Compute the 0–100 Thesis Preservation Score for one generated output. */
export function computeThesisPreservation(input: GeneratorInput, out: GeneratedOutput): ThesisPreservation | undefined {
  const pa = input.research.primaryAngle;
  if (!pa) return undefined;   // pre-10B / v1-only run → not measurable

  const text = out.readyToPublish || '';
  const allWords = new Set(tokens(text));
  const firstPara = (text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)[0] || '');
  const firstWords = new Set(tokens(firstPara));

  // Distinctive thesis / reframe terms.
  const thesisTerms = uniq(contentTerms(pa.thesis)).sort((a, b) => b.length - a.length).slice(0, 14);
  const reframeTerms = uniq(contentTerms(pa.reframe)).filter(t => !thesisTerms.includes(t)).slice(0, 10);

  // 1. Thesis presence — distinctive thesis terms anywhere in the piece.
  const presence = overlapFrac(thesisTerms, allWords);
  // 2. Spine position — thesis terms in the OPENING paragraph (led-with, not buried).
  const spine = overlapFrac(thesisTerms, firstWords);
  // 3. Cross-source preservation — how many core subjects (multi-source topics) appear.
  const topicTermSets = input.research.mainTopics.map(t => contentTerms(t)).filter(ts => ts.length);
  const topicsHit = topicTermSets.filter(ts => ts.some(t => allWords.has(t))).length;
  const crossSource = pa.synthesisBasis.sourceRefs.length <= 1
    ? (topicsHit >= 1 ? 1 : 0)
    : Math.min(1, topicsHit / 2);
  // 4. Editorial sharpness — reframe survives + a contrast/inversion construction exists.
  const reframePresence = overlapFrac(reframeTerms.length ? reframeTerms : thesisTerms, allWords);
  const sharp = Math.min(1, reframePresence * 0.7 + (CONTRAST.test(text) ? 0.3 : 0));
  // 5. Register fidelity — wording matches the angle's register; no overreach phrases.
  const register = pa.uncertaintyHandling.register;
  const forbidden = pa.thesisDiscipline?.wordingGuidance.forbiddenPhrases ?? [];
  const lower = text.toLowerCase();
  const forbiddenHits = forbidden.filter(p => p && lower.includes(p.toLowerCase())).length;
  const hedged = HEDGE.test(text);
  let registerFidelity = 1;
  if (forbiddenHits > 0) registerFidelity -= Math.min(0.6, 0.3 * forbiddenHits);     // overreach
  if ((register === 'speculate' || register === 'hedge') && !hedged) registerFidelity -= 0.4; // overclaiming a non-factual thesis
  registerFidelity = Math.max(0, registerFidelity);
  // 6. Non-flattening — interpretive density (argument), not a flat recap/list.
  const interpCount = (text.match(INTERP) || []).length;
  const sentenceCount = Math.max(1, (text.match(/[.!?。\n]/g) || []).length);
  const nonFlattening = Math.min(1, interpCount / Math.max(3, sentenceCount * 0.35));

  const score = Math.round(
    presence * 25 + spine * 20 + crossSource * 15 + sharp * 15 + registerFidelity * 10 + nonFlattening * 15,
  );
  return {
    score: Math.max(0, Math.min(100, score)),
    thesisPresence:     Math.round(presence * 100),
    spinePosition:      Math.round(spine * 100),
    crossSource:        Math.round(crossSource * 100),
    editorialSharpness: Math.round(sharp * 100),
    registerFidelity:   Math.round(registerFidelity * 100),
    nonFlattening:      Math.round(nonFlattening * 100),
  };
}
