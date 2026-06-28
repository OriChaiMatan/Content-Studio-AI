import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import {
  ResearchContextV2Schema,
  ResearchSynthesisLayerSchema,
  ResearchKnowledgeLayerSchema,
  ThesisDisciplineSchema,
  ThesisCompetitionSchema,
  type ResearchContextV2,
  type PrimaryAngle,
  type ThesisDiscipline,
  type CandidateAngle,
  type ThesisCompetition,
  type ThesisScores,
  type EditorialScores,
  type SourceCoherence,
  type ConnectionKind,
} from '../schemas/aiContractSchemas';

type SynthesisLayer = ResearchContextV2['synthesis'];
type KnowledgeLayer = ResearchContextV2['knowledge'];
type Meta          = ResearchContextV2['meta'];
import { generateResearchContext } from '../services/mockAiService';

// ─────────────────────────────────────────────────────────────────────────────
// Research Synthesis prompts + assembly (Phase 10A)
//
// Claude returns the knowledge + synthesis layers via a forced tool. finalize()
// validates them, computes meta, and maps the v2 layers DOWN into the v1 fields
// so existing consumers (fact_check, content_creation, generatorInput) keep
// working AND benefit from real synthesis with no changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceRef { ref: string; sourceId: string; label: string; role: 'primary' | 'context' }
export interface SynthesisInput {
  run: PipelineRun;
  caseItem: ContentCase;
  primarySources: ContentSource[];
  contextSources: ContentSource[];
  language: 'en' | 'he';
  sourceRefs: SourceRef[];
}

// Shape-tolerant source-intelligence reader (new + legacy shapes).
type SI = {
  summary?: string;
  mainTopics?: string[]; topics?: string[];
  keywords?: string[];
  contentAngles?: string[];
  claims?: (string | { text?: string })[];
  entities?: { name?: string; type?: string }[];
  sentiment?: string;
};

export function buildSourceRefs(primary: ContentSource[], context: ContentSource[]): SourceRef[] {
  const refs: SourceRef[] = [];
  let i = 1;
  for (const s of primary) refs.push({ ref: `S${i++}`, sourceId: s.id, label: s.label || s.type, role: 'primary' });
  for (const s of context) refs.push({ ref: `S${i++}`, sourceId: s.id, label: s.label || s.type, role: 'context' });
  return refs;
}

export function researchSystem(lang: 'en' | 'he'): string {
  const language = lang === 'he' ? 'Hebrew' : 'English';
  return [
    'You are a Research Synthesis engine for a content studio. You receive structured intelligence about one or more SOURCES and must produce cross-source SYNTHESIS — not summaries.',
    '',
    'Your job is to find what NO SINGLE SOURCE states on its own:',
    '- connections between sources (causal, analogical, sequential, tension, convergent, enabling)',
    '- contradictions (factual / evidentiary / scope) and softer values/framing tensions',
    '- second-order implications and non-obvious insights an expert would notice but a journalist might miss',
    '',
    'Hard rules:',
    '- BE COMPACT. Return high-signal, structured intelligence — NOT article-like prose. Every field is a phrase or ONE short sentence; no long explanations, no paragraphs. Thesis QUALITY matters far more than length. Honor every maxLength/maxItems in the tool.',
    '- NO REPETITION. Do not restate the same idea across keyFacts, nonObviousInsights, candidateAngles and the winning thesis. Say each idea ONCE, in the field where it belongs.',
    '- Reference sources ONLY by their [S#] tags. A real sourceConnection MUST cite at least 2 different sources.',
    '- If there is only ONE source, set singleSource=true, lower synthesisConfidence, and produce internal implications/non-obvious angles instead of fabricating multi-source connections.',
    '- Use ONLY the provided source intelligence. Never invent facts, names, numbers, or events.',
    '- Label grounding honestly: "supported" (stated by sources), "inferred" (reasoned), "speculative" (a leap). Speculative leaps are valuable but MUST be labeled.',
    '- Optionally add expertPOV to a non-obvious insight: the conclusion a domain expert would draw (strategic/operational/prediction/practitioner). expertPOV is NEVER a fact — its grounding must be "inferred" or "speculative".',
    '- For contradictions, present BOTH sides and do not pick a winner; the disagreement itself is the story.',
    '- COHERENCE FIRST (coherenceAssessment): BEFORE competing theses, judge whether the sources genuinely share ONE thread. Group them into dominantThemes (each theme + the [S#] it covers); name outlierSourceRefs that fit no thread; set forcedSynthesisRisk. A GENUINE cross-source thesis reveals a SHARED DRIVER — one underlying force, mechanism, or tension that explains multiple sources. A ROUNDUP merely sorts/lists/name-checks sources ("the industry is doing A, B, and C") — that is a FAILURE, not a creative win. Tension or contradiction about the SAME subject is HIGH coherence (the disagreement IS the thread). Sources about DIFFERENT subjects are LOW coherence even if all mention "AI". If the sources do not share a real thread, SAY SO (set forcedSynthesisRisk=high, list themes/outliers) rather than manufacturing a connection — it is better to report "these do not support one strong thesis" than to invent one.',
    '- FORCED vs PRODUCTIVE TENSION: a PRODUCTIVE tension is a disagreement or trade-off about the SAME concrete object — the same market, actor, mechanism, product, or decision (e.g. two sources disputing whether ONE company\'s strategy will work). A FORCED tension connects otherwise-unrelated topics only through a generic abstract opposite — "speed vs regulation", "innovation vs control", "scale vs trust", "growth vs risk", "hype vs reality" — WITHOUT a concrete shared subject or mechanism. A forced tension is a roundup in disguise and is a FAILURE: do NOT use it to justify spanning unrelated sources.',
    '- connectionKind (per candidate): single_mechanism (ONE grounded mechanism explains multiple sources — a real hidden driver), productive_tension (disagreement/trade-off about the SAME concrete subject or mechanism — NOT a generic abstract opposite), grouping_roundup (sorts/lists sources by surface theme), forced_synthesis (connects unrelated domains through an abstract opposite or vague theme — a fake tension/roundup), single_cluster (focuses on one coherent subset, ignoring unrelated sources). If a "tension" is abstract and cross-domain, it is forced_synthesis, NOT productive_tension. Mark fakes HONESTLY — do not disguise a roundup as a tension. "explains-unrelated" is a STRENGTH only with a real grounded mechanism.',
    '- thesisCompetition: generate exactly 5 genuinely DIFFERENT candidate theses (concise — thesis ≤320 chars, reframe ≤220, rationale ≤120) and score each on TWO axes. ANALYTICAL (scores): novelty, explanatoryPower, crossSourceCoverage, discussionPotential, businessValue, strategicDepth. Rules: (a) a candidate must be a THESIS that explains a SYSTEM or structural shift — "sales fell 18%" / "renovations rose" / "demand may be delayed" are observations and must score low; (b) the strongest candidates explain seemingly-unrelated sources, reveal a hidden driver, or reframe the whole topic (mark these in qualifyingProperties); (c) if a thesis can be written from a single source, its crossSourceCoverage MUST be low.',
    '- editorialScores (the STORY axis, scored independently of the analytical axis): score each candidate as a world-class EDITOR would — readerCuriosity (would a serious reader keep reading), reframeStrength (overturns the default assumption), narrativeTension (conflict / paradox / irony / tradeoff / unresolved stakes), headlinePower (could be a headline in The Economist / Bloomberg / Stratechery / HBR). Editorial power means making a SERIOUS reader stop, care, understand the stakes, and remember the thesis — it is NEVER clickbait, tabloid, or rage-bait. A thesis can be analytically deep yet editorially flat (abstract, jargon-y); say so honestly with a low editorial score. Then set recommendedWinnerIndex to the candidate you would actually put on the cover.',
    '- winnerDiscipline (inside thesisCompetition): for your recommended winner ONLY, stress-test it like a senior analyst (NOT a fact-checker), CONCISELY: supportLevel; supportingEvidence (≤3, with refs); assumptions (≤2, + risk if wrong); counterArguments (≤2; at least one strong one for any inferred/speculative thesis); alternativeExplanations (≤2, ordinary/competing reasons); overreachWarnings (≤2, claims the thesis tempts but sources do NOT support, with safer wording); wordingGuidance. One short sentence per item.',
    `- Write all natural-language text in ${language}. Proper nouns / product / company names may stay in their original language.`,
    '- Return ONLY the structured result via the tool. No prose, no markdown.',
  ].join('\n');
}

// Phase 10D.2 — COMPACT source cards. Pass curated sourceIntelligence (capped to
// top-5 per field), NOT full extractedText. The raw extract excerpt (≤800 chars)
// is included ONLY as a fallback when no analysis summary exists — so a long
// Calcalist/Fidelity URL extraction never bloats the synthesis input.
export function renderSynthesisContext(input: SynthesisInput): string {
  const byId = new Map(input.sourceRefs.map(r => [r.sourceId, r]));
  const all = [...input.primarySources, ...input.contextSources];
  const cap = <T,>(arr: T[] | undefined, n: number): T[] => (Array.isArray(arr) ? arr.slice(0, n) : []);
  const trunc = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + '…' : (s ?? ''));
  const blocks = all.map(s => {
    const r = byId.get(s.id);
    const si = (s.sourceIntelligence as SI | null) ?? null;
    const summary = (si?.summary ?? '').trim();
    const hasSI = !!(summary || (si?.claims?.length) || (si?.mainTopics?.length ?? si?.topics?.length));
    const claims = cap((si?.claims ?? []).map(c => (typeof c === 'string' ? c : c?.text ?? '')).filter(Boolean), 5);
    const entities = cap((si?.entities ?? []).map(e => `${e?.name ?? ''}${e?.type ? ` (${e.type})` : ''}`).filter(Boolean), 5);
    const topics = cap(si?.mainTopics ?? si?.topics, 5);
    const angles = cap(si?.contentAngles, 5);
    const keywords = cap(si?.keywords, 5);
    const lines = [
      `[${r?.ref}] "${trunc(s.label || s.type, 100)}" (${s.type}, ${r?.role}, ${input.language})`,
    ];
    if (hasSI) {
      lines.push(`  Summary: ${trunc(summary, 400) || '(none)'}`);
      lines.push(`  Topics: ${topics.join(', ') || '(none)'}`);
      if (angles.length)   lines.push(`  Angles: ${angles.join(', ')}`);
      lines.push(`  Keywords: ${keywords.join(', ') || '(none)'}`);
      lines.push(`  Claims (top 5): ${claims.length ? claims.map(c => `\n    - ${trunc(c, 200)}`).join('') : '(none)'}`);
      lines.push(`  Entities: ${entities.join(', ') || '(none)'}`);
      lines.push(`  Sentiment: ${si?.sentiment ?? 'neutral'}`);
    } else {
      // No analysis available → fall back to a short raw excerpt only.
      const excerpt = trunc((s.content ?? '').replace(/\s+/g, ' ').trim(), 800);
      lines.push(`  (No analysis available — raw extract excerpt, ≤800 chars)`);
      lines.push(`  Extract: ${excerpt || '(empty)'}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const c = input.caseItem;
  return [
    '## CASE BRIEF',
    `Title: ${c.title}`,
    `Goal: ${c.contentGoal}`,
    `Style: ${c.contentStyle}`,
    `Sources: ${input.primarySources.length} primary, ${input.contextSources.length} context`,
    '',
    '## SOURCE INTELLIGENCE',
    blocks,
    '',
    `Synthesize across the above sources now via the tool. Reference sources by [S#].`,
  ].join('\n');
}

const expertPOVProps = {
  type:      { type: 'string', enum: ['strategic', 'operational', 'prediction', 'practitioner'] },
  statement: { type: 'string' },
  grounding: { type: 'string', enum: ['inferred', 'speculative'], description: 'expertPOV is never a fact.' },
};
const groundingEnum = ['supported', 'inferred', 'speculative'];

// Phase 10C — thesisDiscipline JSON-schema fragment (reused for the winner).
const disciplineProp = { type: 'object' as const, description: 'Stress-test the thesis (concise; NOT fact-check). Even if the facts are true, is THIS the best explanation, and how strongly may we state it? Keep every item to one short sentence.', properties: {
  supportLevel: { type: 'string', enum: ['strong','moderate','weak'] },
  supportingEvidence: { type: 'array', maxItems: 3, items: { type: 'object', properties: {
    claim: { type: 'string', maxLength: 200 }, sourceRefs: { type: 'array', items: { type: 'string' } }, strength: { type: 'string', enum: ['strong','moderate','weak'] } }, required: ['claim','sourceRefs','strength'] } },
  assumptions: { type: 'array', maxItems: 2, items: { type: 'object', properties: {
    assumption: { type: 'string', maxLength: 160 }, whyItMatters: { type: 'string', maxLength: 160 }, riskIfWrong: { type: 'string', maxLength: 160 } }, required: ['assumption','whyItMatters','riskIfWrong'] } },
  counterArguments: { type: 'array', maxItems: 2, description: 'The strongest objections (≤2). Provide at least one for any inferred/speculative thesis.', items: { type: 'object', properties: {
    argument: { type: 'string', maxLength: 200 }, sourceRefs: { type: 'array', items: { type: 'string' } }, strength: { type: 'string', enum: ['strong','moderate','weak'] } }, required: ['argument','strength'] } },
  alternativeExplanations: { type: 'array', maxItems: 2, description: 'Other plausible explanations (≤2).', items: { type: 'object', properties: {
    explanation: { type: 'string', maxLength: 200 }, whyPlausible: { type: 'string', maxLength: 160 } }, required: ['explanation','whyPlausible'] } },
  overreachWarnings: { type: 'array', maxItems: 2, description: 'Claims the thesis tempts but the sources do NOT support (≤2) — with safer wording.', items: { type: 'object', properties: {
    riskyClaim: { type: 'string', maxLength: 160 }, saferWording: { type: 'string', maxLength: 200 }, reason: { type: 'string', maxLength: 160 } }, required: ['riskyClaim','saferWording','reason'] } },
  wordingGuidance: { type: 'object', properties: {
    allowedStrength: { type: 'string', enum: ['assertive','balanced','cautious','speculative'] },
    requiredQualifiers: { type: 'array', items: { type: 'string' } },
    forbiddenPhrases: { type: 'array', items: { type: 'string' } } }, required: ['allowedStrength','requiredQualifiers','forbiddenPhrases'] },
}, required: ['supportLevel','supportingEvidence','assumptions','counterArguments','alternativeExplanations','overreachWarnings','wordingGuidance'] };

export const RESEARCH_TOOL: Anthropic.Tool = {
  name: 'record_research_synthesis',
  description: 'Record the cross-source research synthesis.',
  input_schema: {
    type: 'object',
    properties: {
      singleSource:        { type: 'boolean' },
      synthesisConfidence: { type: 'integer', minimum: 0, maximum: 100 },
      coreSubjects: { type: 'array', maxItems: 4, items: { type: 'object', properties: {
        name: { type: 'string' }, type: { type: 'string', enum: ['company','person','product','technology','concept','trend','organization','location'] },
        role: { type: 'string', maxLength: 120 }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['name','type','role','sourceRefs'] } },
      keyFacts: { type: 'array', maxItems: 7, items: { type: 'object', properties: {
        statement: { type: 'string', maxLength: 200 }, type: { type: 'string', enum: ['announcement','statistic','claim','definition','event','opinion','prediction'] },
        sourceRefs: { type: 'array', items: { type: 'string' } }, grounding: { type: 'string', enum: ['stated','implied'] },
        status: { type: 'string', enum: ['claimed','corroborated','disputed','unverified'] }, confidence: { type: 'integer', minimum: 0, maximum: 100 } },
        required: ['statement','type','sourceRefs','grounding','status','confidence'] } },
      mainStory: { type: 'object', properties: { headline: { type: 'string', maxLength: 140 }, summary: { type: 'string', maxLength: 400 }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['headline','summary','sourceRefs'] },
      sourceConnections: { type: 'array', maxItems: 5, items: { type: 'object', properties: {
        description: { type: 'string', maxLength: 240 }, sourceRefs: { type: 'array', items: { type: 'string' } },
        type: { type: 'string', enum: ['causal','analogical','sequential','tension','convergent','enabling'] },
        novelty: { type: 'integer', minimum: 0, maximum: 100 }, confidence: { type: 'integer', minimum: 0, maximum: 100 },
        grounding: { type: 'string', enum: groundingEnum } }, required: ['description','sourceRefs','type','novelty','confidence','grounding'] } },
      tensions: { type: 'array', maxItems: 4, items: { type: 'object', properties: { description: { type: 'string', maxLength: 240 }, poles: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['description','poles','sourceRefs'] } },
      contradictions: { type: 'array', maxItems: 4, items: { type: 'object', properties: {
        subject: { type: 'string', maxLength: 120 }, claimA: { type: 'string', maxLength: 200 }, claimB: { type: 'string', maxLength: 200 }, sourceRefs: { type: 'array', items: { type: 'string' } },
        nature: { type: 'string', enum: ['factual','evidentiary','scope'] }, severity: { type: 'integer', minimum: 0, maximum: 100 }, resolution: { type: 'string', maxLength: 200 } },
        required: ['subject','claimA','claimB','sourceRefs','nature','severity','resolution'] } },
      secondOrderImplications: { type: 'array', maxItems: 2, items: { type: 'object', properties: {
        implication: { type: 'string', maxLength: 220 }, basis: { type: 'array', items: { type: 'string' } }, horizon: { type: 'string', enum: ['now','near','long'] },
        confidence: { type: 'integer', minimum: 0, maximum: 100 }, speculative: { type: 'boolean' } }, required: ['implication','basis','horizon','confidence','speculative'] } },
      nonObviousInsights: { type: 'array', maxItems: 5, items: { type: 'object', properties: {
        insight: { type: 'string', maxLength: 240 }, reasoning: { type: 'string', maxLength: 200 }, sourceRefs: { type: 'array', items: { type: 'string' } },
        novelty: { type: 'integer', minimum: 0, maximum: 100 }, lens: { type: 'string', enum: ['analogical','second-order','contrarian','absence','stakeholder'], description: 'The REASONING lens that produced this insight (how you saw it) — NOT a relationship/connection type. Pick exactly one: "analogical" (a parallel to another domain), "second-order" (a downstream/ripple consequence), "contrarian" (cuts against the conventional read), "absence" (notable for what is missing or unsaid), "stakeholder" (seen through one actor\'s incentives). Do NOT use connection types here (e.g. "causal", "tension", "sequential", "convergent", "enabling" are INVALID for lens).' },
        speculative: { type: 'boolean' }, expertPOV: { type: 'object', properties: expertPOVProps, required: ['type','statement','grounding'] } },
        required: ['insight','reasoning','sourceRefs','novelty','lens','speculative'] } },
      openQuestions: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 200 } },
      // Phase 10D — THESIS COMPETITION: generate multiple competing theses, score
      // each, and recommend a winner. Phase 10B/10C: the winner becomes the
      // narrative spine (primaryAngle) and carries winnerDiscipline.
      thesisCompetition: { type: 'object', description: 'Behave like a world-class editor, not a cautious analyst. Generate exactly 5 genuinely DIFFERENT candidate theses for this material, score each, and recommend the STRONGEST (not the safest). A real thesis explains a SYSTEM, not an event. "Sales fell 18%" / "renovations rose" are observations, NOT theses. A winning thesis must explain seemingly-unrelated sources, reveal a hidden driver, or reframe the whole topic.', properties: {
        candidateAngles: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', properties: {
          thesis:    { type: 'string', maxLength: 320, description: 'A thesis that explains a system/structural shift — not a restatement of one source. Concise (≤320 chars).' },
          reframe:   { type: 'string', maxLength: 220, description: 'A "the real story is X, not the obvious Y" hook seed (≤220 chars).' },
          basisKind: { type: 'string', enum: ['connection','tension','contradiction','insight','implication'] },
          grounding: { type: 'string', enum: ['factual','inferred','speculative'] },
          sourceRefs:{ type: 'array', items: { type: 'string' }, description: 'The [S#] this thesis genuinely requires.' },
          rationale: { type: 'string', maxLength: 120, description: 'Why this explains the evidence — ONE concise sentence, max 120 chars.' },
          qualifyingProperties: { type: 'array', items: { type: 'string', enum: ['explains-unrelated','hidden-driver','reframes-topic'] }, description: 'Strong-thesis properties this satisfies (a winner needs ≥1).' },
          connectionKind: { type: 'string', enum: ['single_mechanism','productive_tension','grouping_roundup','forced_synthesis','single_cluster'], description: 'single_mechanism = one grounded mechanism explains multiple sources (real hidden driver); productive_tension = disagreement/trade-off about the SAME concrete subject or mechanism (NOT a generic abstract opposite); grouping_roundup = surface grouping / name-checking; forced_synthesis = connects unrelated domains via an abstract opposite ("speed vs regulation", "scale vs trust") or vague theme — a fake tension/roundup; single_cluster = focuses on one coherent subset. Abstract cross-domain "tension" is forced_synthesis, NOT productive_tension. Mark fakes HONESTLY.' },
          scores: { type: 'object', description: 'ANALYTICAL axis — score each dimension 1–10, honestly.', properties: {
            novelty:             { type: 'integer', minimum: 1, maximum: 10, description: 'Would an intelligent reader learn something unexpected?' },
            explanatoryPower:    { type: 'integer', minimum: 1, maximum: 10, description: 'How much of the evidence does it explain?' },
            crossSourceCoverage: { type: 'integer', minimum: 1, maximum: 10, description: 'How many sources are GENUINELY required? If writable from one source, this MUST be low (1–3).' },
            discussionPotential: { type: 'integer', minimum: 1, maximum: 10, description: 'Would professionals want to debate it?' },
            businessValue:       { type: 'integer', minimum: 1, maximum: 10, description: 'Would it matter to decision-makers?' },
            strategicDepth:      { type: 'integer', minimum: 1, maximum: 10, description: 'Structural shift (high) vs surface event (low).' },
          }, required: ['novelty','explanatoryPower','crossSourceCoverage','discussionPotential','businessValue','strategicDepth'] },
          editorialScores: { type: 'object', description: 'EDITORIAL axis (the STORY, not the analysis). Editorial power = make a SERIOUS reader stop, care, grasp the stakes, and remember the thesis. NOT clickbait, NOT tabloid, NOT rage-bait. Score 1–10.', properties: {
            readerCuriosity:  { type: 'integer', minimum: 1, maximum: 10, description: 'Would an intelligent reader want to keep reading?' },
            reframeStrength:  { type: 'integer', minimum: 1, maximum: 10, description: 'Does it overturn the default/obvious assumption?' },
            narrativeTension: { type: 'integer', minimum: 1, maximum: 10, description: 'Conflict, paradox, irony, tradeoff, pressure, contradiction, or unresolved stakes?' },
            headlinePower:    { type: 'integer', minimum: 1, maximum: 10, description: 'Could this plausibly be a headline in The Economist / Bloomberg / Stratechery / HBR? (serious, not sensational)' },
          }, required: ['readerCuriosity','reframeStrength','narrativeTension','headlinePower'] },
        }, required: ['thesis','reframe','basisKind','grounding','sourceRefs','rationale','qualifyingProperties','connectionKind','scores','editorialScores'] } },
        recommendedWinnerIndex: { type: 'integer', minimum: 0, description: 'Index into candidateAngles of the strongest thesis.' },
        winnerDiscipline: disciplineProp,
      }, required: ['candidateAngles','recommendedWinnerIndex','winnerDiscipline'] },
      // Phase 4A — coherence assessment (judged BEFORE the thesis is forced).
      coherenceAssessment: { type: 'object', description: 'Do these sources genuinely share ONE thread, or would a single thesis be a forced roundup? Reporting low coherence is BETTER than manufacturing a connection.', properties: {
        dominantThemes:   { type: 'array', items: { type: 'object', properties: { theme: { type: 'string', maxLength: 120 }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['theme','sourceRefs'] }, description: 'Group the sources into themes; each theme lists the [S#] it covers. One dominant theme covering most sources = coherent; several themes splitting the sources = incoherent.' },
        outlierSourceRefs:{ type: 'array', items: { type: 'string' }, description: '[S#] that fit no shared thread.' },
        forcedSynthesisRisk: { type: 'string', enum: ['low','medium','high'], description: 'high = a single thesis would have to manufacture or strain a connection across unrelated sources.' },
        rationale:        { type: 'string', maxLength: 240, description: 'One sentence: is there a genuine shared thread, or are these separate stories?' },
      }, required: ['dominantThemes','outlierSourceRefs','forcedSynthesisRisk','rationale'] },
    },
    required: ['singleSource','synthesisConfidence','mainStory','sourceConnections','nonObviousInsights','openQuestions','thesisCompetition','coherenceAssessment'],
  },
};

// ── Assembly helpers ──────────────────────────────────────────────────────────
const str = (v: unknown) => String(v ?? '');
const dedupe = (a: string[]) => [...new Set(a.filter(Boolean))];
function clampMin(arr: string[], min: number, max: number, fallback: string[]): string[] {
  const out = dedupe(arr).slice(0, max);
  if (out.length >= min) return out;
  for (const f of fallback) { if (out.length >= min) break; if (!out.includes(f)) out.push(f); }
  return out.slice(0, max);
}

// ── Primary Angle selection (Phase 10B) ───────────────────────────────────────
// Deterministic: assemble the narrative spine from Claude's nomination when it
// is present + valid, else fall back to a priority ladder over the synthesis.
// No extra Claude call. Always returns a usable angle (never throws).
type Register = PrimaryAngle['uncertaintyHandling']['register'];
const registerFor = (g: PrimaryAngle['grounding']): Register =>
  g === 'speculative' ? 'speculate' : g === 'inferred' ? 'hedge' : 'assert';

function selectAngleBase(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
): PrimaryAngle {
  const validRefs = new Set(meta.sourceRefMap.map(r => r.ref));
  const keep = (refs: unknown): string[] => (Array.isArray(refs) ? refs.map(String).filter(r => validRefs.has(r)) : []);
  // Facts whose sourceRefs intersect the basis — the concrete material that substantiates the thesis.
  const factsFor = (refs: string[]): string[] => {
    const set = new Set(refs);
    const hits = knowledge.keyFacts.filter(f => f.sourceRefs.some(r => set.has(r))).map(f => f.statement);
    return dedupe(hits.length ? hits : knowledge.keyFacts.map(f => f.statement)).slice(0, 6);
  };
  const insightByText = (t: string) => synthesis.nonObviousInsights.find(n => n.insight === t);

  // 1) Claude's nomination (assembled, not trusted blindly).
  const nom = raw.primaryAngle as Record<string, unknown> | undefined;
  if (nom && typeof nom.thesis === 'string' && typeof nom.reframe === 'string') {
    const basisKind = String(nom.basisKind ?? 'insight');
    const kind: PrimaryAngle['kind'] =
      basisKind === 'tension' ? 'tension'
      : basisKind === 'contradiction' ? 'contradiction'
      : basisKind === 'implication' ? 'implication'
      : basisKind === 'connection' ? 'connection'
      : 'insight';
    let refs = keep(nom.sourceRefs);
    if (meta.singleSource && refs.length > 1) refs = refs.slice(0, 1);
    const grounding = (['factual','inferred','speculative'].includes(String(nom.grounding)) ? nom.grounding : 'inferred') as PrimaryAngle['grounding'];
    const matchedInsight = insightByText(String(nom.thesis));
    const tension = synthesis.tensions[0];
    const contra = synthesis.contradictions[0];
    return {
      thesis:  String(nom.thesis),
      reframe: String(nom.reframe),
      kind:    meta.singleSource ? 'single-source-insight' : kind,
      grounding,
      synthesisBasis: { sourceRefs: refs, excerpt: matchedInsight?.reasoning || String(nom.thesis) },
      tensionPoles:
        kind === 'tension' && tension ? { a: tension.poles[0], b: tension.poles[1] }
        : kind === 'contradiction' && contra ? { a: contra.claimA, b: contra.claimB }
        : undefined,
      expertPOV: matchedInsight?.expertPOV,
      supportingFacts: factsFor(refs.length ? refs : meta.sourceRefMap.map(r => r.ref)),
      uncertaintyHandling: { register: registerFor(grounding), hedgedClaims: [] },
      confidence: Math.min(meta.synthesisConfidence, meta.singleSource ? 60 : 100),
    };
  }

  // 2) Deterministic priority ladder.
  // Single source: an internal insight, never a fabricated cross-source claim.
  if (meta.singleSource) {
    const ins = synthesis.nonObviousInsights[0];
    const grounding: PrimaryAngle['grounding'] = ins?.speculative ? 'speculative' : 'inferred';
    const refs = (ins?.sourceRefs ?? meta.sourceRefMap.slice(0, 1).map(r => r.ref)).slice(0, 1);
    return {
      thesis: ins?.insight ?? synthesis.mainStory.summary,
      reframe: synthesis.mainStory.headline,
      kind: 'single-source-insight', grounding,
      synthesisBasis: { sourceRefs: refs, excerpt: ins?.reasoning || ins?.insight || synthesis.mainStory.summary },
      expertPOV: ins?.expertPOV,
      supportingFacts: factsFor(refs),
      uncertaintyHandling: { register: registerFor(grounding), hedgedClaims: [] },
      confidence: Math.min(meta.synthesisConfidence, 60),
    };
  }
  // Contradiction → the measurement-gap story.
  const contra = synthesis.contradictions[0];
  if (contra) {
    const grounding: PrimaryAngle['grounding'] = contra.nature === 'factual' ? 'factual' : 'inferred';
    return {
      thesis: `The real story is the gap between competing claims about ${contra.subject} — and which evidence we should trust.`,
      reframe: `${contra.subject}: "${contra.claimA}" vs. "${contra.claimB}"`,
      kind: 'contradiction', grounding,
      synthesisBasis: { sourceRefs: contra.sourceRefs, excerpt: contra.resolution || `${contra.claimA} vs ${contra.claimB}` },
      tensionPoles: { a: contra.claimA, b: contra.claimB },
      supportingFacts: factsFor(contra.sourceRefs),
      uncertaintyHandling: { register: 'hedge', hedgedClaims: [contra.claimA, contra.claimB] },
      confidence: meta.synthesisConfidence,
    };
  }
  // Tension → the competing-forces story.
  const tension = synthesis.tensions[0];
  if (tension) {
    return {
      thesis: tension.description,
      reframe: `${tension.poles[0]} vs. ${tension.poles[1]}`,
      kind: 'tension', grounding: 'inferred',
      synthesisBasis: { sourceRefs: tension.sourceRefs, excerpt: tension.description },
      tensionPoles: { a: tension.poles[0], b: tension.poles[1] },
      supportingFacts: factsFor(tension.sourceRefs),
      uncertaintyHandling: { register: 'hedge', hedgedClaims: [] },
      confidence: meta.synthesisConfidence,
    };
  }
  // Strongest non-obvious insight (prefer ≥2 refs, expertPOV-bearing, higher novelty).
  const ranked = [...synthesis.nonObviousInsights].sort((a, b) => {
    const score = (n: typeof a) => (n.sourceRefs.length >= 2 ? 40 : 0) + (n.expertPOV ? 30 : 0) + Math.round((n.novelty ?? 0) / 5);
    return score(b) - score(a);
  });
  const top = ranked[0];
  if (top) {
    const grounding: PrimaryAngle['grounding'] = top.speculative ? 'speculative' : 'inferred';
    return {
      thesis: top.insight,
      reframe: top.insight,
      kind: top.sourceRefs.length >= 2 ? 'connection' : 'insight', grounding,
      synthesisBasis: { sourceRefs: top.sourceRefs, excerpt: top.reasoning || top.insight },
      expertPOV: top.expertPOV,
      supportingFacts: factsFor(top.sourceRefs.length ? top.sourceRefs : meta.sourceRefMap.map(r => r.ref)),
      uncertaintyHandling: { register: registerFor(grounding), hedgedClaims: [] },
      confidence: meta.synthesisConfidence,
    };
  }
  // Last resort: a connection, else the main story itself.
  const conn = synthesis.sourceConnections[0];
  const refs = conn ? conn.sourceRefs : synthesis.mainStory.sourceRefs;
  return {
    thesis: conn?.description ?? synthesis.mainStory.summary,
    reframe: synthesis.mainStory.headline,
    kind: conn ? 'connection' : 'insight', grounding: 'inferred',
    synthesisBasis: { sourceRefs: refs, excerpt: conn?.description ?? synthesis.mainStory.summary },
    supportingFacts: factsFor(refs.length ? refs : meta.sourceRefMap.map(r => r.ref)),
    uncertaintyHandling: { register: 'hedge', hedgedClaims: [] },
    confidence: meta.synthesisConfidence,
  };
}

// ── Thesis discipline (Phase 10C) ─────────────────────────────────────────────
// Derive counter-arguments deterministically from the synthesis itself: tensions
// and contradictions ARE the opposing readings; contrarian insights are objections.
function deriveCounters(synthesis: SynthesisLayer): ThesisDiscipline['counterArguments'] {
  const out: ThesisDiscipline['counterArguments'] = [];
  for (const t of synthesis.tensions)
    out.push({ argument: `Counter-force: ${t.poles[1]} pulls against ${t.poles[0]}.`, sourceRefs: t.sourceRefs, strength: 'moderate' });
  for (const c of synthesis.contradictions)
    out.push({ argument: `On ${c.subject}, the opposing reading is: "${c.claimB}".`, sourceRefs: c.sourceRefs, strength: c.nature === 'evidentiary' ? 'strong' : 'moderate' });
  for (const n of synthesis.nonObviousInsights.filter(n => n.lens === 'contrarian'))
    out.push({ argument: n.insight, sourceRefs: n.sourceRefs, strength: 'moderate' });
  return out.slice(0, 2);   // Phase 10D.2 — cap counter-arguments at 2
}

const FORBIDDEN = ['definitely', 'guarantees', 'will replace', 'completely solves', 'eliminates entirely', 'destroys', 'proves that', 'inevitably'];

function buildThesisDiscipline(
  synthesis: SynthesisLayer,
  meta: Meta,
  base: PrimaryAngle,
  disciplineNom?: unknown,
): ThesisDiscipline {
  const validRefs = new Set(meta.sourceRefMap.map(r => r.ref));
  const keep = (refs: unknown): string[] => (Array.isArray(refs) ? refs.map(String).filter(r => validRefs.has(r)) : []);

  // Wording controls derived from grounding + single-source + register.
  const allowedStrength: ThesisDiscipline['wordingGuidance']['allowedStrength'] =
    meta.singleSource ? 'cautious'
    : base.grounding === 'factual' ? 'assertive'
    : base.grounding === 'inferred' ? 'balanced'
    : 'speculative';
  const requiredQualifiers =
    base.uncertaintyHandling.register === 'speculate' ? ['could', 'may', 'one possible implication', 'an emerging question']
    : base.uncertaintyHandling.register === 'hedge' ? ['may', 'appears to', 'early signs suggest']
    : [];
  let supportLevel: ThesisDiscipline['supportLevel'] =
    base.grounding === 'factual' ? 'strong' : base.grounding === 'inferred' ? 'moderate' : 'weak';
  if (meta.singleSource) supportLevel = supportLevel === 'strong' ? 'moderate' : 'weak';

  // 1) Use Claude's winner discipline when it validates; sanitize refs, then
  //    ensure a counter-argument exists for any non-factual thesis.
  const nom = disciplineNom;
  if (nom && typeof nom === 'object') {
    const n = nom as Record<string, any>;
    const sanitized = {
      ...n,
      supportingEvidence: Array.isArray(n.supportingEvidence) ? n.supportingEvidence.map((e: any) => ({ ...e, sourceRefs: keep(e?.sourceRefs) })) : [],
      counterArguments:   Array.isArray(n.counterArguments) ? n.counterArguments.map((c: any) => ({ ...c, sourceRefs: keep(c?.sourceRefs) })) : [],
      wordingGuidance: {
        allowedStrength:    n?.wordingGuidance?.allowedStrength ?? allowedStrength,
        requiredQualifiers: Array.isArray(n?.wordingGuidance?.requiredQualifiers) ? n.wordingGuidance.requiredQualifiers : requiredQualifiers,
        forbiddenPhrases:   dedupe([...(Array.isArray(n?.wordingGuidance?.forbiddenPhrases) ? n.wordingGuidance.forbiddenPhrases : []), ...FORBIDDEN]),
      },
    };
    const parsed = ThesisDisciplineSchema.safeParse(sanitized);
    if (parsed.success) {
      const d = parsed.data;
      // Phase 10D.2 — hard caps (3 / 2 / 2 / 2 / 2) regardless of what Claude returned.
      d.supportingEvidence = d.supportingEvidence.slice(0, 3);
      d.assumptions = d.assumptions.slice(0, 2);
      d.counterArguments = d.counterArguments.slice(0, 2);
      d.alternativeExplanations = d.alternativeExplanations.slice(0, 2);
      d.overreachWarnings = d.overreachWarnings.slice(0, 2);
      if (base.grounding !== 'factual' && d.counterArguments.length === 0) d.counterArguments = deriveCounters(synthesis);
      return d;
    }
  }

  // 2) Deterministic fallback assembled from the synthesis.
  return {
    supportLevel,
    supportingEvidence: base.supportingFacts.slice(0, 3).map(f => ({ claim: f, sourceRefs: base.synthesisBasis.sourceRefs, strength: 'moderate' as const })),
    assumptions: [],
    counterArguments: deriveCounters(synthesis),
    alternativeExplanations: synthesis.openQuestions.slice(0, 2).map(q => ({ explanation: q, whyPlausible: 'Raised as an open question by the synthesis — a competing reading the thesis does not rule out.' })),
    overreachWarnings: [],
    wordingGuidance: { allowedStrength, requiredQualifiers, forbiddenPhrases: FORBIDDEN },
  };
}

// ── Thesis competition (Phase 10D) ────────────────────────────────────────────
// Weights tuned so the safe/predictable thesis cannot win by default: novelty,
// cross-source coverage and strategic depth are weighted up.
const SCORE_WEIGHTS: Record<keyof ThesisScores, number> = {
  novelty: 1.2, explanatoryPower: 1.0, crossSourceCoverage: 1.3,
  discussionPotential: 0.9, businessValue: 1.0, strategicDepth: 1.3,
};
const WEIGHT_SUM = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
const SCORE_KEYS = Object.keys(SCORE_WEIGHTS) as (keyof ThesisScores)[];
const clampScore = (v: unknown) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + '…' : s);
function computeOverall(s: ThesisScores): number {
  const total = SCORE_KEYS.reduce((acc, k) => acc + s[k] * SCORE_WEIGHTS[k], 0);
  return Math.round((total / WEIGHT_SUM) * 10) / 10;
}
function lowerDims(win: ThesisScores, run: ThesisScores): string {
  const k = SCORE_KEYS.filter(d => run[d] < win[d]);
  return k.length ? k.join(', ') : 'overall value';
}
function factsForRefs(knowledge: KnowledgeLayer, refs: string[]): string[] {
  const set = new Set(refs);
  const hits = knowledge.keyFacts.filter(f => f.sourceRefs.some(r => set.has(r))).map(f => f.statement);
  return dedupe(hits.length ? hits : knowledge.keyFacts.map(f => f.statement)).slice(0, 6);
}
function heuristicScores(refsLen: number, grounding: PrimaryAngle['grounding']): ThesisScores {
  const cov = refsLen >= 3 ? 8 : refsLen === 2 ? 6 : 3;
  const nov = grounding === 'speculative' ? 7 : grounding === 'inferred' ? 6 : 4;
  return { novelty: nov, explanatoryPower: cov, crossSourceCoverage: cov, discussionPotential: 6, businessValue: 6, strategicDepth: grounding === 'factual' ? 4 : 6 };
}

// ── Editorial axis (Phase 10D.1) ──────────────────────────────────────────────
const EDITORIAL_KEYS = ['readerCuriosity', 'reframeStrength', 'narrativeTension', 'headlinePower'] as const;
function computeEditorial(e: EditorialScores): number {
  return Math.round(((e.readerCuriosity + e.reframeStrength + e.narrativeTension + e.headlinePower) / 4) * 10) / 10;
}
// Deterministic editorial scores — used only if Claude omits them (robustness),
// derived from analytical signals so a fallback never blanks the editorial axis.
function editorialFallback(scores: ThesisScores, props: CandidateAngle['qualifyingProperties'], basisKind: string): EditorialScores {
  const tensionLike = basisKind === 'tension' || basisKind === 'contradiction';
  const reframes = props.includes('reframes-topic');
  return {
    readerCuriosity:  clampScore(Math.round((scores.novelty + scores.discussionPotential) / 2)),
    reframeStrength:  clampScore(reframes ? 8 : props.includes('hidden-driver') ? 6 : Math.round(scores.novelty * 0.7)),
    narrativeTension: clampScore(tensionLike ? 8 : reframes ? 6 : 5),
    headlinePower:    clampScore(Math.round((scores.novelty + scores.discussionPotential) / 2)),
  };
}

type RawCandidate = {
  thesis: string; reframe: string; basisKind: string; grounding: PrimaryAngle['grounding'];
  sourceRefs: string[]; rationale: string; qualifyingProperties: CandidateAngle['qualifyingProperties'];
  scores: ThesisScores; editorialScores: EditorialScores; connectionKind: ConnectionKind;
};

// Phase 4A — classify how a candidate connects its sources when Claude omits it.
// single_mechanism = one grounded mechanism explains multiple sources (a real
// hidden driver); productive_tension = same-subject disagreement; grouping_roundup
// = surface grouping / name-checking (a fake roundup); single_cluster = one subset.
const CONNECTION_KINDS = ['single_mechanism', 'productive_tension', 'grouping_roundup', 'forced_synthesis', 'single_cluster'];
// Phase 4A.1 — fake-connection kinds: a roundup, or a forced/abstract tension that
// connects unrelated domains only through a generic opposite.
const FAKE_KINDS = new Set<ConnectionKind>(['grouping_roundup', 'forced_synthesis']);
function deriveConnectionKind(basisKind: string, grounding: PrimaryAngle['grounding'], props: string[], refsLen: number): ConnectionKind {
  if (basisKind === 'tension' || basisKind === 'contradiction') return 'productive_tension';
  if (refsLen < 2) return 'single_cluster';
  if (props.includes('explains-unrelated')) return grounding === 'speculative' ? 'grouping_roundup' : 'single_mechanism';
  return 'single_mechanism';
}

// Phase 4A — DETERMINISTIC coherence from the theme structure (hard to game) +
// connection grounding + roundup fraction. Claude's forcedSynthesisRisk is a
// one-way SAFETY CAP: it can only LOWER coherence, never inflate it. Single-source
// runs are trivially coherent (exempt).
export function computeCoherence(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  meta: Meta,
  cands: RawCandidate[],
): SourceCoherence {
  const validRefs = new Set(meta.sourceRefMap.map(r => r.ref));
  const keep = (refs: unknown): string[] => (Array.isArray(refs) ? refs.map(String).filter(r => validRefs.has(r)) : []);
  const sourceCount = Math.max(1, meta.sourceCount);

  if (meta.singleSource) {
    return { score: 100, label: 'coherent', rationale: 'Single source — coherence not applicable.', dominantThemes: [], outlierSourceRefs: [], forcedSynthesisRisk: 'low' };
  }

  const ca = (raw.coherenceAssessment ?? {}) as Record<string, any>;
  const themes = (Array.isArray(ca.dominantThemes) ? ca.dominantThemes : [])
    .map((t: any) => ({ theme: String(t?.theme ?? ''), sourceRefs: keep(t?.sourceRefs) }))
    .filter((t: { theme: string }) => t.theme.length > 0);
  const outliers = keep(ca.outlierSourceRefs);
  const claudeRisk: SourceCoherence['forcedSynthesisRisk'] = ['low', 'medium', 'high'].includes(String(ca.forcedSynthesisRisk)) ? ca.forcedSynthesisRisk : 'low';

  const themeCount = themes.length || 1;
  const topThemeCoverage = themes.length ? Math.max(...themes.map((t: { sourceRefs: string[] }) => t.sourceRefs.length)) / sourceCount : 1;
  const outlierFrac = outliers.length / sourceCount;
  const conns = synthesis.sourceConnections ?? [];
  const gq = conns.length ? conns.reduce((a, c) => a + (c.grounding === 'supported' ? 1 : c.grounding === 'inferred' ? 0.5 : 0), 0) / conns.length : 0.5;
  // Phase 4A.1 — fake-connection fraction now includes forced_synthesis (abstract
  // cross-domain "tension"), not just grouping_roundup.
  const roundupFrac = cands.length ? cands.filter(c => FAKE_KINDS.has(c.connectionKind)).length / cands.length : 0;

  let score = 100 * (
      0.40 * Math.min(1, topThemeCoverage)
    + 0.25 * (1 - Math.min(1, (themeCount - 1) / 3))
    + 0.10 * (1 - Math.min(1, outlierFrac))
    + 0.10 * gq
    + 0.15 * (1 - roundupFrac)               // Phase 4A.1 — weight fakes more
  );
  // Phase 4A.1 — MULTI-DOMAIN penalty: sources spread across ≥2 themes with NO
  // dominant theme and NO honest outliers = a genuinely multi-topic set a single
  // thesis can only connect by force. Deterministic (independent of Claude's
  // optimism / mislabeling). Safe for the good cases: a genuine hidden driver
  // yields ONE dominant theme, so this never fires on them.
  if (themeCount >= 2 && topThemeCoverage < 0.6 && outliers.length === 0) score -= 22;
  // One-way safety caps from Claude's risk self-report (tightened in 4A.1).
  if (claudeRisk === 'high') score = Math.min(score, 40);
  else if (claudeRisk === 'medium') score = Math.min(score, 58);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const label: SourceCoherence['label'] =
    themeCount >= 3 ? 'multi-topic'
    : score >= 75 ? 'coherent'
    : score >= 55 ? 'partial'
    : score >= 35 ? 'low'
    : 'multi-topic';

  const derivedRisk: SourceCoherence['forcedSynthesisRisk'] = label === 'coherent' ? 'low' : label === 'partial' ? 'medium' : 'high';
  const RISK_ORD = { low: 0, medium: 1, high: 2 } as const;
  const forcedSynthesisRisk = RISK_ORD[claudeRisk] >= RISK_ORD[derivedRisk] ? claudeRisk : derivedRisk;

  return {
    score, label,
    rationale: String(ca.rationale ?? '').slice(0, 240) || `${themeCount} theme(s), ${outliers.length} outlier(s).`,
    dominantThemes: themes, outlierSourceRefs: outliers, forcedSynthesisRisk,
  };
}

// Deterministic candidates from the synthesis itself — used only if Claude omits
// the competition (robustness). Each synthesis element is itself a candidate thesis.
function deterministicCandidates(synthesis: SynthesisLayer, meta: Meta, keep: (r: unknown) => string[]): RawCandidate[] {
  const out: RawCandidate[] = [];
  const add = (thesis: string, reframe: string, refsRaw: unknown, grounding: PrimaryAngle['grounding'], props: CandidateAngle['qualifyingProperties'], rationale: string, basisKind = 'insight') => {
    const sourceRefs = keep(refsRaw);
    const scores = heuristicScores(sourceRefs.length, grounding);
    if (!meta.singleSource && sourceRefs.length < 2) scores.crossSourceCoverage = Math.min(scores.crossSourceCoverage, 2);
    out.push({ thesis, reframe, basisKind, grounding, sourceRefs, rationale, qualifyingProperties: props, scores, editorialScores: editorialFallback(scores, props, basisKind), connectionKind: deriveConnectionKind(basisKind, grounding, props, sourceRefs.length) });
  };
  for (const n of synthesis.nonObviousInsights) add(n.insight, n.insight, n.sourceRefs, n.speculative ? 'speculative' : 'inferred', n.lens === 'contrarian' ? ['reframes-topic'] : ['hidden-driver'], n.reasoning || n.insight, 'insight');
  for (const t of synthesis.tensions) add(t.description, `${t.poles[0]} vs ${t.poles[1]}`, t.sourceRefs, 'inferred', ['explains-unrelated'], t.description, 'tension');
  for (const c of synthesis.contradictions) add(`The real story is the gap on ${c.subject}.`, `${c.claimA} vs ${c.claimB}`, c.sourceRefs, c.nature === 'factual' ? 'factual' : 'inferred', ['hidden-driver'], c.resolution || c.subject, 'contradiction');
  for (const cn of synthesis.sourceConnections) add(cn.description, cn.description, cn.sourceRefs, cn.grounding === 'supported' ? 'factual' : (cn.grounding as PrimaryAngle['grounding']), ['explains-unrelated'], cn.description, 'connection');
  if (out.length === 0) add(synthesis.mainStory.summary, synthesis.mainStory.headline, synthesis.mainStory.sourceRefs, 'inferred', ['reframes-topic'], synthesis.mainStory.summary);
  return out.slice(0, 8);
}

export function buildCompetition(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
): { competition: ThesisCompetition; winnerRaw: RawCandidate; winnerDiscipline?: unknown; coherence: SourceCoherence } {
  const validRefs = new Set(meta.sourceRefMap.map(r => r.ref));
  const keep = (refs: unknown): string[] => (Array.isArray(refs) ? refs.map(String).filter(r => validRefs.has(r)) : []);
  const QUAL = ['explains-unrelated', 'hidden-driver', 'reframes-topic'];

  const tc = raw.thesisCompetition as Record<string, any> | undefined;
  const rawList: any[] = Array.isArray(tc?.candidateAngles) ? tc!.candidateAngles : [];

  let cands: RawCandidate[] = rawList
    .filter(c => c && typeof c.thesis === 'string' && typeof c.reframe === 'string')
    .map(c => {
      const grounding = (['factual', 'inferred', 'speculative'].includes(String(c.grounding)) ? c.grounding : 'inferred') as PrimaryAngle['grounding'];
      const refs = keep(c.sourceRefs);
      const props = (Array.isArray(c.qualifyingProperties) ? c.qualifyingProperties : []).filter((p: string) => QUAL.includes(p)) as CandidateAngle['qualifyingProperties'];
      const sc = (c.scores && typeof c.scores === 'object') ? c.scores : heuristicScores(refs.length, grounding);
      const scores: ThesisScores = {
        novelty: clampScore(sc.novelty), explanatoryPower: clampScore(sc.explanatoryPower),
        crossSourceCoverage: clampScore(sc.crossSourceCoverage), discussionPotential: clampScore(sc.discussionPotential),
        businessValue: clampScore(sc.businessValue), strategicDepth: clampScore(sc.strategicDepth),
      };
      // Single-source penalty (multi-source context): a thesis needing <2 sources can't claim cross-source coverage.
      if (!meta.singleSource && refs.length < 2) scores.crossSourceCoverage = Math.min(scores.crossSourceCoverage, 2);
      const basisKind = String(c.basisKind ?? 'insight');
      const ec = (c.editorialScores && typeof c.editorialScores === 'object') ? c.editorialScores : null;
      const editorialScores: EditorialScores = ec ? {
        readerCuriosity: clampScore(ec.readerCuriosity), reframeStrength: clampScore(ec.reframeStrength),
        narrativeTension: clampScore(ec.narrativeTension), headlinePower: clampScore(ec.headlinePower),
      } : editorialFallback(scores, props, basisKind);
      // Phase 4A — connection kind from Claude (validated) or derived.
      const connectionKind: ConnectionKind = CONNECTION_KINDS.includes(String(c.connectionKind))
        ? (c.connectionKind as ConnectionKind)
        : deriveConnectionKind(basisKind, grounding, props, refs.length);
      // Phase 10D.2 — hard-cap the internal rationale (never user-facing). Phase 11C: 180→120.
      return { thesis: String(c.thesis), reframe: String(c.reframe), basisKind, grounding, sourceRefs: refs, rationale: truncate(String(c.rationale ?? c.thesis), 120), qualifyingProperties: props, scores, editorialScores, connectionKind };
    });

  if (cands.length === 0) cands = deterministicCandidates(synthesis, meta, keep);

  // Phase 4A — coherence (deterministic). lowCoherence gates the scoring changes
  // below; it is PERMISSIVE (only score < 55, i.e. label 'low'/'multi-topic') so
  // 'coherent' and 'partial' cases keep the exact 10D behavior.
  let coherence = computeCoherence(raw, synthesis, meta, cands);
  const lowCoherence = !meta.singleSource && coherence.score < 55;

  let candidates: CandidateAngle[] = cands.map(c => ({
    thesis: c.thesis, reframe: c.reframe, grounding: c.grounding, sourceRefs: c.sourceRefs,
    rationale: c.rationale, qualifyingProperties: c.qualifyingProperties, scores: c.scores,
    overallValue: computeOverall(c.scores),
    editorialScores: c.editorialScores, editorialValue: computeEditorial(c.editorialScores),
    connectionKind: c.connectionKind,
  }));

  // Phase 4A — when coherence is LOW, penalize fake roundups and stop rewarding
  // breadth. When coherence is OK (default), penalty is 0 and behavior is IDENTICAL
  // to 10D. Hidden-driver (single_mechanism), tension, and single_cluster are never
  // penalized — we kill roundups, not insight.
  // Phase 4A.1 — a fake connection is a roundup, a forced_synthesis, OR (when
  // coherence is low) an abstract productive_tension that spans ALL sources across
  // ≥2 themes (a forced tension mislabeled as productive).
  const themeCount4a1 = coherence.dominantThemes.length;
  const isFakeConnection = (i: number): boolean => {
    const k = cands[i].connectionKind;
    if (FAKE_KINDS.has(k)) return true;
    if (lowCoherence && k === 'productive_tension' && candidates[i].sourceRefs.length >= meta.sourceCount && themeCount4a1 >= 2) return true;
    return false;
  };
  const coherencePenalty = (i: number): number => {
    if (!lowCoherence) return 0;
    if (isFakeConnection(i)) return 4;
    if (candidates[i].qualifyingProperties.includes('explains-unrelated') && cands[i].connectionKind !== 'single_mechanism') return 2;
    return 0;
  };
  const effValue = (i: number): number => candidates[i].overallValue - coherencePenalty(i);

  // Analytical floor: a finalist must explain unrelated sources, reveal a hidden
  // driver, or reframe the topic (the 10D rule) — coherence-aware in 4A.
  const qualifies = (i: number): boolean => {
    const c = candidates[i];
    let q =
      c.qualifyingProperties.length > 0 &&
      (c.sourceRefs.length >= 2 || c.qualifyingProperties.includes('reframes-topic') || c.qualifyingProperties.includes('hidden-driver'));
    if (lowCoherence) {
      if (isFakeConnection(i)) q = false;                               // roundups / forced tensions never qualify when incoherent
      if (cands[i].connectionKind === 'single_cluster' && c.overallValue >= 6) q = true;   // a strong single-cluster thesis may win
    }
    return q;
  };
  // Cross-source GATE: a multi-source finalist must require ≥2 sources — RELAXED in
  // 4A so a strong single-cluster thesis can win when coherence is low.
  const crossSourceOK = (i: number): boolean =>
    meta.singleSource || candidates[i].sourceRefs.length >= 2 || (lowCoherence && cands[i].connectionKind === 'single_cluster');

  // ── Analytical comparator. When coherence is OK, identical to 10D (effValue ==
  //    overallValue, crossSourceCoverage tiebreak retained). When low, roundups are
  //    de-valued and breadth (crossSourceCoverage) is NOT rewarded. ──
  const byAnalytical = (a: number, b: number): number => {
    const qa = qualifies(a) ? 1 : 0, qb = qualifies(b) ? 1 : 0;
    if (qa !== qb) return qb - qa;
    if (effValue(b) !== effValue(a)) return effValue(b) - effValue(a);
    if (!lowCoherence && candidates[b].scores.crossSourceCoverage !== candidates[a].scores.crossSourceCoverage) return candidates[b].scores.crossSourceCoverage - candidates[a].scores.crossSourceCoverage;
    return candidates[b].scores.novelty - candidates[a].scores.novelty;
  };

  // ── Phase 11C — DETERMINISTIC HARD CAP at 5 candidates ──
  // The tool's maxItems:5 is advisory; Claude (or the deterministic fallback) can
  // emit more, inflating output tokens/runtime and undermining the compaction goal.
  // ALL emitted candidates are scored first (overallValue/editorialValue above), then
  // we keep the strongest 5 by the SAME analytical comparator used for finalist
  // selection — never by raw emission order. cands and candidates stay PARALLEL so
  // winnerRaw / discipline mapping stay correct, and every downstream index
  // (analytical/editorial winners, finalists, runner-up) refers to this capped array.
  const emittedCount = candidates.length;
  let recommended = Number(tc?.recommendedWinnerIndex ?? -1);
  if (candidates.length > 5) {
    const keptIdx = candidates.map((_, i) => i).sort(byAnalytical).slice(0, 5).sort((a, b) => a - b);
    candidates  = keptIdx.map(i => candidates[i]);
    cands       = keptIdx.map(i => cands[i]);
    recommended = keptIdx.indexOf(recommended);   // remap to capped indices (-1 if the model's pick was cut)
  }

  // ── Stage 1 — analytical ranking (UNCHANGED from 10D) ──
  const analyticalOrder = candidates.map((_, i) => i).sort(byAnalytical);
  const analyticalWinnerIndex = analyticalOrder[0];

  // ── Stage 2 — editorial funnel (Phase 10D.1) ──
  // Eligible = qualifying + cross-source gate. Finalists = MORE INCLUSIVE of
  // {top-3 by analytical} and {within Δ1.0 of the max analytical value}.
  const eligible = analyticalOrder.filter(i => qualifies(i) && crossSourceOK(i));
  const pool = eligible.length ? eligible : analyticalOrder;   // safety: never empty
  const maxA = effValue(pool[0]);
  const within = pool.filter(i => maxA - effValue(i) <= 1.0);
  const top3 = pool.slice(0, 3);
  const finalists = within.length >= top3.length ? within : top3;

  // Phase 10D.1 SUPPORT-LEVEL FLOOR: weak-support theses may be finalists (scored
  // + displayed) but may NOT win editorial selection. Mirrors 10C's deterministic
  // supportLevel (grounding + single-source downgrade) so it matches the discipline
  // that will be stamped on the winner. Falls back to the full finalist set only if
  // EVERY finalist is weak — so a winner always exists.
  const supportLevelOf = (c: CandidateAngle): 'strong' | 'moderate' | 'weak' => {
    let s: 'strong' | 'moderate' | 'weak' = c.grounding === 'factual' ? 'strong' : c.grounding === 'inferred' ? 'moderate' : 'weak';
    if (meta.singleSource) s = s === 'strong' ? 'moderate' : 'weak';
    return s;
  };
  const winnerEligible = finalists.filter(i => supportLevelOf(candidates[i]) !== 'weak');
  const winnerPool = winnerEligible.length ? winnerEligible : finalists;

  // Editorial winner among the eligible pool: editorialValue → analyticalValue → coverage.
  // Single eligible finalist ⇒ editorial competition is a no-op (winner = that finalist).
  const edSorted = [...winnerPool].sort((a, b) => {
    const ea = candidates[a].editorialValue ?? 0, eb = candidates[b].editorialValue ?? 0;
    if (eb !== ea) return eb - ea;
    if (candidates[b].overallValue !== candidates[a].overallValue) return candidates[b].overallValue - candidates[a].overallValue;
    return candidates[b].scores.crossSourceCoverage - candidates[a].scores.crossSourceCoverage;
  });
  const winnerIndex = winnerPool.length ? edSorted[0] : analyticalWinnerIndex;   // SAFEGUARD: winner ∈ finalists
  const editorialWinnerIndex = winnerIndex;
  // Note when a higher-editorial finalist was skipped purely for weak support.
  const topEditorialFinalist = [...finalists].sort((a, b) => (candidates[b].editorialValue ?? 0) - (candidates[a].editorialValue ?? 0))[0];
  const weakSkipped = topEditorialFinalist != null && topEditorialFinalist !== winnerIndex && supportLevelOf(candidates[topEditorialFinalist]) === 'weak';
  const runnerUpIndex =
    analyticalWinnerIndex !== winnerIndex ? analyticalWinnerIndex
    : analyticalOrder.find(i => i !== winnerIndex);

  const win = candidates[winnerIndex];
  const aWin = candidates[analyticalWinnerIndex];
  const topEdDims = [...EDITORIAL_KEYS].sort((a, b) => win.editorialScores![b] - win.editorialScores![a]).slice(0, 2);

  const reasonForSelection =
    `Editorial winner of ${finalists.length} finalist(s): editorial ${win.editorialValue}/10 (strongest on ${topEdDims.join(', ')}), analytical ${win.overallValue}/10; qualifies as [${win.qualifyingProperties.join(', ') || 'overall strength'}]; genuinely requires ${win.sourceRefs.length} source(s).`;
  const weakNote = weakSkipped
    ? ` Higher-editorial finalist "${truncate(candidates[topEditorialFinalist].thesis)}" (editorial ${candidates[topEditorialFinalist].editorialValue}/10) was EXCLUDED from winning: weak support.`
    : '';
  const editorialReason = (
    winnerIndex === analyticalWinnerIndex
      ? `Editorial winner is also the analytical #1 (editorial ${win.editorialValue}/10).`
      : `Chosen over analytical #1 "${truncate(aWin.thesis)}" (analytical ${aWin.overallValue} vs ${win.overallValue}; editorial ${win.editorialValue} vs ${aWin.editorialValue}/10) — a stronger STORY (higher ${topEdDims.join(', ')}) among analytically-qualified finalists.`
  ) + weakNote;
  const runnerCand = runnerUpIndex != null ? candidates[runnerUpIndex] : undefined;
  // Phase 11C — surface the hard cap in the existing diagnostic field (no new schema).
  const capNote = emittedCount > candidates.length
    ? ` Capped from ${emittedCount} emitted candidates to the top 5 by analytical value (Phase 11C).`
    : '';
  const reasonOthersLost = (runnerCand
    ? `Runner-up "${truncate(runnerCand.thesis)}" — analytical ${runnerCand.overallValue}/10, editorial ${runnerCand.editorialValue}/10. Non-finalists were observations, single-source, or explained fewer sources.`
    : 'Only one viable finalist.') + capNote;

  const competition = ThesisCompetitionSchema.parse({
    candidates, winnerIndex, runnerUpIndex, reasonForSelection, reasonOthersLost,
    finalists, analyticalWinnerIndex, editorialWinnerIndex, editorialReason,
  });
  // Use Claude's winnerDiscipline only if it nominated the SAME thesis that won;
  // otherwise 10C discipline is built deterministically for the editorial winner.
  // (`recommended` was captured + remapped to capped indices above.)
  // Phase 4A.1 — if the editorial winner is itself a fake connection (the gate did
  // not fire, but the best thesis is still a roundup / forced tension), downgrade
  // the PERSISTED coherence so the signal reflects reality.
  if (!meta.singleSource && FAKE_KINDS.has(cands[winnerIndex].connectionKind)) {
    coherence = {
      ...coherence,
      score: Math.min(coherence.score, 45),
      label: coherence.label === 'multi-topic' ? 'multi-topic' : 'low',
      forcedSynthesisRisk: 'high',
    };
  }

  const winnerDiscipline = recommended === winnerIndex ? tc?.winnerDiscipline : undefined;
  return { competition, winnerRaw: cands[winnerIndex], winnerDiscipline, coherence };
}

function angleFromCandidate(c: RawCandidate, synthesis: SynthesisLayer, knowledge: KnowledgeLayer, meta: Meta): PrimaryAngle {
  const refs = meta.singleSource ? c.sourceRefs.slice(0, 1) : c.sourceRefs;
  const kind: PrimaryAngle['kind'] =
    meta.singleSource ? 'single-source-insight'
    : c.basisKind === 'tension' ? 'tension'
    : c.basisKind === 'contradiction' ? 'contradiction'
    : c.basisKind === 'implication' ? 'implication'
    : c.basisKind === 'connection' ? 'connection'
    : refs.length >= 2 ? 'connection' : 'insight';
  const matchedInsight = synthesis.nonObviousInsights.find(n => n.insight === c.thesis);
  const tension = synthesis.tensions[0];
  const contra = synthesis.contradictions[0];
  return {
    thesis: c.thesis, reframe: c.reframe, kind, grounding: c.grounding,
    synthesisBasis: { sourceRefs: refs, excerpt: c.rationale },
    tensionPoles: kind === 'tension' && tension ? { a: tension.poles[0], b: tension.poles[1] }
      : kind === 'contradiction' && contra ? { a: contra.claimA, b: contra.claimB } : undefined,
    expertPOV: matchedInsight?.expertPOV,
    supportingFacts: factsForRefs(knowledge, refs.length ? refs : meta.sourceRefMap.map(r => r.ref)),
    uncertaintyHandling: { register: registerFor(c.grounding), hedgedClaims: [] },
    confidence: Math.min(meta.synthesisConfidence, meta.singleSource ? 60 : 100),
  };
}

/** 10D competition → winning thesis → 10B spine + 10C discipline. */
export function selectThesis(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
): { primaryAngle: PrimaryAngle; competition: ThesisCompetition; coherence: SourceCoherence } {
  const { competition, winnerRaw, winnerDiscipline, coherence } = buildCompetition(raw, synthesis, knowledge, meta);
  const base = winnerRaw ? angleFromCandidate(winnerRaw, synthesis, knowledge, meta) : selectAngleBase(raw, synthesis, knowledge, meta);
  const primaryAngle: PrimaryAngle = { ...base, thesisDiscipline: buildThesisDiscipline(synthesis, meta, base, winnerDiscipline) };
  return { primaryAngle, competition, coherence };
}

/** Validate Claude's synthesis output and assemble the v1-valid v2 superset. */
// Phase 11D.1 — RESEARCH RETRY RESILIENCE. Claude occasionally mis-emits a recoverable
// DIAGNOSTIC-ONLY enum — most often nonObviousInsights[].lens receiving a sourceConnection
// type ("causal"/"tension"/…). Strict Zod then rejected the WHOLE synthesis and forced a
// second full synthesis call (~90–195s, the dominant stage). We coerce ONLY these
// non-load-bearing labels to a safe in-enum value before validation, so they can no longer
// trigger a retry. This is behavior-preserving: the insight text, sourceRefs, novelty,
// speculative flag and expertPOV.statement are untouched; the only downstream use of `lens`
// branches on `=== 'contrarian'`, and an invalid value was already not 'contrarian', so
// mapping it to 'second-order' takes the identical branch. expertPOV.type/grounding are
// display-only metadata (the consumed field is expertPOV.statement). NOTHING that feeds the
// thesis competition, editorial selection, thesisDiscipline, primaryAngle, or content is
// coerced here — genuinely structural errors still take the existing corrective-retry path.
const VALID_LENS = new Set(['analogical', 'second-order', 'contrarian', 'absence', 'stakeholder']);
const VALID_POV_TYPE = new Set(['strategic', 'operational', 'prediction', 'practitioner']);
const VALID_POV_GROUNDING = new Set(['inferred', 'speculative']);
function coerceInsightDiagnostics(n: any): any {
  if (!n || typeof n !== 'object') return n;
  const out = { ...n };
  if (!VALID_LENS.has(out.lens)) out.lens = 'second-order';   // non-contrarian default → identical downstream branch
  if (out.expertPOV && typeof out.expertPOV === 'object') {
    const pov = { ...out.expertPOV };
    if (!VALID_POV_TYPE.has(pov.type)) pov.type = 'strategic';
    if (!VALID_POV_GROUNDING.has(pov.grounding)) pov.grounding = 'inferred';   // expertPOV is never a fact
    out.expertPOV = pov;
  }
  return out;
}

export function finalizeSynthesis(raw: Record<string, unknown>, input: SynthesisInput): ResearchContextV2 {
  const validRefs = new Set(input.sourceRefs.map(r => r.ref));
  const keepRefs = (refs: unknown): string[] => (Array.isArray(refs) ? refs.map(String).filter(r => validRefs.has(r)) : []);

  // Validate knowledge + synthesis layers (drops unknown refs first).
  const knowledge = ResearchKnowledgeLayerSchema.parse({
    coreSubjects: (Array.isArray(raw.coreSubjects) ? raw.coreSubjects : []).map((s: any) => ({ ...s, sourceRefs: keepRefs(s.sourceRefs) })).filter((s: any) => s.sourceRefs.length > 0),
    keyFacts:     (Array.isArray(raw.keyFacts) ? raw.keyFacts : []).map((f: any) => ({ ...f, sourceRefs: keepRefs(f.sourceRefs) })).filter((f: any) => f.sourceRefs.length > 0),
  });
  const synthesis = ResearchSynthesisLayerSchema.parse({
    mainStory:               { ...(raw.mainStory as any), sourceRefs: keepRefs((raw.mainStory as any)?.sourceRefs) },
    supportingStories:       (Array.isArray(raw.supportingStories) ? raw.supportingStories : []).map((s: any) => ({ ...s, sourceRefs: keepRefs(s.sourceRefs) })),
    sourceConnections:       (Array.isArray(raw.sourceConnections) ? raw.sourceConnections : []).map((c: any) => ({ ...c, sourceRefs: keepRefs(c.sourceRefs) })),
    tensions:                (Array.isArray(raw.tensions) ? raw.tensions : []).map((t: any) => ({ ...t, sourceRefs: keepRefs(t.sourceRefs) })),
    contradictions:          (Array.isArray(raw.contradictions) ? raw.contradictions : []).map((c: any) => ({ ...c, sourceRefs: keepRefs(c.sourceRefs) })),
    secondOrderImplications: Array.isArray(raw.secondOrderImplications) ? raw.secondOrderImplications : [],
    nonObviousInsights:      (Array.isArray(raw.nonObviousInsights) ? raw.nonObviousInsights : []).map((n: any) => coerceInsightDiagnostics({ ...n, sourceRefs: keepRefs(n.sourceRefs) })),
    openQuestions:           (Array.isArray(raw.openQuestions) ? raw.openQuestions.map(String) : []).filter(Boolean),
  });

  const singleSource = input.sourceRefs.length <= 1;
  const meta = {
    sourceCount:         input.sourceRefs.length,
    primarySourceCount:  input.primarySources.length,
    contextSourceCount:  input.contextSources.length,
    synthesisConfidence: Math.max(0, Math.min(100, Number(raw.synthesisConfidence ?? 70) | 0)),
    singleSource,
    generatorVersion:    'research-1',
    degraded:            false,
    sourceRefMap:        input.sourceRefs,
  };

  // ── Map v2 → v1 (so existing consumers benefit) ──
  const insightTexts = synthesis.nonObviousInsights.map(n => n.insight);
  const expertTexts = synthesis.nonObviousInsights.map(n => n.expertPOV?.statement).filter((s): s is string => !!s);
  const connectionTexts = synthesis.sourceConnections.map(c => c.description);
  const summary = synthesis.mainStory.summary.length >= 10
    ? synthesis.mainStory.summary
    : `${synthesis.mainStory.headline} — ${synthesis.mainStory.summary}`.padEnd(10, '.');

  const v1Contradictions = [
    ...synthesis.contradictions.map(c => `${c.subject}: "${c.claimA}" vs "${c.claimB}"`),
    ...synthesis.tensions.map(t => t.description),
  ];

  // Phase 10D — run the thesis competition; the winner becomes the spine (10B)
  // and carries its discipline (10C). Diagnostics stored on the synthesis layer.
  const { primaryAngle, competition, coherence } = selectThesis(raw, synthesis, knowledge, meta);

  const v2: ResearchContextV2 = {
    runId:    input.run.id,
    caseId:   input.caseItem.id,
    language: input.language,
    summary,
    mainTopics:      clampMin(knowledge.coreSubjects.map(s => s.name), 1, 10, [synthesis.mainStory.headline, 'General topic']),
    keyInsights:     clampMin([...insightTexts, ...expertTexts, ...connectionTexts], 1, 10, [synthesis.mainStory.summary, 'Synthesis insight']),
    importantClaims: dedupe(knowledge.keyFacts.map(f => f.statement)).slice(0, 15),
    suggestedAngles: clampMin([...insightTexts, ...expertTexts, ...connectionTexts], 1, 6, [synthesis.mainStory.headline]),
    suggestedHooks:  clampMin([...synthesis.openQuestions, ...insightTexts], 1, 5, [synthesis.mainStory.headline]),
    sourceReferences: input.sourceRefs.map(r => r.label),
    contradictions:  v1Contradictions,
    risks:           synthesis.openQuestions,
    confidenceScore: meta.synthesisConfidence,
    meta: { ...meta, coherence },   // Phase 4A — persist the coherence assessment
    knowledge,
    synthesis: { ...synthesis, primaryAngle, thesisCompetition: competition },
  };

  return ResearchContextV2Schema.parse(v2);
}

/** v2-valid stub from the permanent v1 mock — disabled path and fallback. */
export function buildV2Stub(input: SynthesisInput, generatorVersion: string, degraded: boolean): ResearchContextV2 {
  const v1 = generateResearchContext(input.run, input.caseItem, input.primarySources, input.contextSources);
  const singleSource = input.sourceRefs.length <= 1;
  // Phase 10B — degraded spine from the mock's top angle/insight. Inferred,
  // hedged, capped confidence; no fabricated cross-source basis.
  const spineText = v1.suggestedAngles[0] ?? v1.keyInsights[0] ?? v1.summary;
  const degradedAngle: PrimaryAngle = {
    thesis: spineText,
    reframe: v1.suggestedHooks[0] ?? spineText,
    kind: singleSource ? 'single-source-insight' : 'insight',
    grounding: 'inferred',
    synthesisBasis: { sourceRefs: [], excerpt: spineText },
    supportingFacts: dedupe(v1.importantClaims).slice(0, 6),
    uncertaintyHandling: { register: 'hedge', hedgedClaims: [] },
    confidence: Math.min(v1.confidenceScore, 55),
    // Phase 10C — degraded discipline: weak support, cautious wording, no fabricated counters.
    thesisDiscipline: {
      supportLevel: 'weak',
      supportingEvidence: dedupe(v1.importantClaims).slice(0, 3).map(c => ({ claim: c, sourceRefs: [], strength: 'weak' as const })),
      assumptions: [],
      counterArguments: [],
      alternativeExplanations: [],
      overreachWarnings: [],
      wordingGuidance: { allowedStrength: 'cautious', requiredQualifiers: ['may', 'appears to'], forbiddenPhrases: FORBIDDEN },
    },
  };
  const v2: ResearchContextV2 = {
    ...v1,
    meta: {
      sourceCount: input.sourceRefs.length,
      primarySourceCount: input.primarySources.length,
      contextSourceCount: input.contextSources.length,
      synthesisConfidence: v1.confidenceScore,
      singleSource,
      generatorVersion,
      degraded,
      sourceRefMap: input.sourceRefs,
    },
    knowledge: { coreSubjects: [], keyFacts: [] },
    synthesis: {
      mainStory: { headline: input.caseItem.title, summary: v1.summary, sourceRefs: [] },
      supportingStories: [], sourceConnections: [], tensions: [], contradictions: [],
      secondOrderImplications: [],
      nonObviousInsights: v1.keyInsights.slice(0, 5).map(i => ({
        insight: i, reasoning: 'Derived by the deterministic mock (no cross-source synthesis).',
        sourceRefs: [], novelty: 30, lens: 'second-order' as const, speculative: false,
      })),
      openQuestions: v1.risks,
      primaryAngle: degradedAngle,
      // Phase 10D — single degraded candidate; no real competition was run.
      thesisCompetition: {
        candidates: [{
          thesis: degradedAngle.thesis, reframe: degradedAngle.reframe, grounding: 'inferred',
          sourceRefs: [], rationale: degradedAngle.thesis, qualifyingProperties: [],
          scores: { novelty: 4, explanatoryPower: 4, crossSourceCoverage: 2, discussionPotential: 4, businessValue: 4, strategicDepth: 3 },
          overallValue: computeOverall({ novelty: 4, explanatoryPower: 4, crossSourceCoverage: 2, discussionPotential: 4, businessValue: 4, strategicDepth: 3 }),
        }],
        winnerIndex: 0,
        reasonForSelection: 'Degraded mock fallback — no thesis competition was run.',
        reasonOthersLost: '',
      },
    },
  };
  return ResearchContextV2Schema.parse(v2);
}
