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
        }, required: ['thesis','reframe','basisKind','grounding','sourceRefs','rationale','qualifyingProperties','scores','editorialScores'] } },
        recommendedWinnerIndex: { type: 'integer', minimum: 0, description: 'Index into candidateAngles of the strongest thesis.' },
        winnerDiscipline: disciplineProp,
      }, required: ['candidateAngles','recommendedWinnerIndex','winnerDiscipline'] },
    },
    required: ['singleSource','synthesisConfidence','mainStory','sourceConnections','nonObviousInsights','openQuestions','thesisCompetition'],
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
  scores: ThesisScores; editorialScores: EditorialScores;
};

// Deterministic candidates from the synthesis itself — used only if Claude omits
// the competition (robustness). Each synthesis element is itself a candidate thesis.
function deterministicCandidates(synthesis: SynthesisLayer, meta: Meta, keep: (r: unknown) => string[]): RawCandidate[] {
  const out: RawCandidate[] = [];
  const add = (thesis: string, reframe: string, refsRaw: unknown, grounding: PrimaryAngle['grounding'], props: CandidateAngle['qualifyingProperties'], rationale: string, basisKind = 'insight') => {
    const sourceRefs = keep(refsRaw);
    const scores = heuristicScores(sourceRefs.length, grounding);
    if (!meta.singleSource && sourceRefs.length < 2) scores.crossSourceCoverage = Math.min(scores.crossSourceCoverage, 2);
    out.push({ thesis, reframe, basisKind, grounding, sourceRefs, rationale, qualifyingProperties: props, scores, editorialScores: editorialFallback(scores, props, basisKind) });
  };
  for (const n of synthesis.nonObviousInsights) add(n.insight, n.insight, n.sourceRefs, n.speculative ? 'speculative' : 'inferred', n.lens === 'contrarian' ? ['reframes-topic'] : ['hidden-driver'], n.reasoning || n.insight, 'insight');
  for (const t of synthesis.tensions) add(t.description, `${t.poles[0]} vs ${t.poles[1]}`, t.sourceRefs, 'inferred', ['explains-unrelated'], t.description, 'tension');
  for (const c of synthesis.contradictions) add(`The real story is the gap on ${c.subject}.`, `${c.claimA} vs ${c.claimB}`, c.sourceRefs, c.nature === 'factual' ? 'factual' : 'inferred', ['hidden-driver'], c.resolution || c.subject, 'contradiction');
  for (const cn of synthesis.sourceConnections) add(cn.description, cn.description, cn.sourceRefs, cn.grounding === 'supported' ? 'factual' : (cn.grounding as PrimaryAngle['grounding']), ['explains-unrelated'], cn.description, 'connection');
  if (out.length === 0) add(synthesis.mainStory.summary, synthesis.mainStory.headline, synthesis.mainStory.sourceRefs, 'inferred', ['reframes-topic'], synthesis.mainStory.summary);
  return out.slice(0, 8);
}

function buildCompetition(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
): { competition: ThesisCompetition; winnerRaw: RawCandidate; winnerDiscipline?: unknown } {
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
      // Phase 10D.2 — hard-cap the internal rationale (never user-facing). Phase 11C: 180→120.
      return { thesis: String(c.thesis), reframe: String(c.reframe), basisKind, grounding, sourceRefs: refs, rationale: truncate(String(c.rationale ?? c.thesis), 120), qualifyingProperties: props, scores, editorialScores };
    });

  if (cands.length === 0) cands = deterministicCandidates(synthesis, meta, keep);

  let candidates: CandidateAngle[] = cands.map(c => ({
    thesis: c.thesis, reframe: c.reframe, grounding: c.grounding, sourceRefs: c.sourceRefs,
    rationale: c.rationale, qualifyingProperties: c.qualifyingProperties, scores: c.scores,
    overallValue: computeOverall(c.scores),
    editorialScores: c.editorialScores, editorialValue: computeEditorial(c.editorialScores),
  }));

  // Analytical floor: a finalist must explain unrelated sources, reveal a hidden
  // driver, or reframe the topic (the 10D qualifying rule).
  const qualifies = (c: CandidateAngle) =>
    c.qualifyingProperties.length > 0 &&
    (c.sourceRefs.length >= 2 || c.qualifyingProperties.includes('reframes-topic') || c.qualifyingProperties.includes('hidden-driver'));
  // Cross-source GATE (Phase 10D.1 safeguard): in a multi-source case a finalist
  // must genuinely require ≥2 sources. Single-source theses can never be finalists here.
  const crossSourceOK = (c: CandidateAngle) => meta.singleSource || c.sourceRefs.length >= 2;

  // ── Analytical comparator (the 10D ordering) — extracted so the Phase 11C cap and
  //    the Stage-1 ranking below use IDENTICAL scoring logic. ──
  const byAnalytical = (a: number, b: number): number => {
    const qa = qualifies(candidates[a]) ? 1 : 0, qb = qualifies(candidates[b]) ? 1 : 0;
    if (qa !== qb) return qb - qa;
    if (candidates[b].overallValue !== candidates[a].overallValue) return candidates[b].overallValue - candidates[a].overallValue;
    if (candidates[b].scores.crossSourceCoverage !== candidates[a].scores.crossSourceCoverage) return candidates[b].scores.crossSourceCoverage - candidates[a].scores.crossSourceCoverage;
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
  const eligible = analyticalOrder.filter(i => qualifies(candidates[i]) && crossSourceOK(candidates[i]));
  const pool = eligible.length ? eligible : analyticalOrder;   // safety: never empty
  const maxA = candidates[pool[0]].overallValue;
  const within = pool.filter(i => maxA - candidates[i].overallValue <= 1.0);
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
  const winnerDiscipline = recommended === winnerIndex ? tc?.winnerDiscipline : undefined;
  return { competition, winnerRaw: cands[winnerIndex], winnerDiscipline };
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
): { primaryAngle: PrimaryAngle; competition: ThesisCompetition } {
  const { competition, winnerRaw, winnerDiscipline } = buildCompetition(raw, synthesis, knowledge, meta);
  const base = winnerRaw ? angleFromCandidate(winnerRaw, synthesis, knowledge, meta) : selectAngleBase(raw, synthesis, knowledge, meta);
  const primaryAngle: PrimaryAngle = { ...base, thesisDiscipline: buildThesisDiscipline(synthesis, meta, base, winnerDiscipline) };
  return { primaryAngle, competition };
}

/** Validate Claude's synthesis output and assemble the v1-valid v2 superset. */
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
    nonObviousInsights:      (Array.isArray(raw.nonObviousInsights) ? raw.nonObviousInsights : []).map((n: any) => ({ ...n, sourceRefs: keepRefs(n.sourceRefs) })),
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
  const { primaryAngle, competition } = selectThesis(raw, synthesis, knowledge, meta);

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
    meta,
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
