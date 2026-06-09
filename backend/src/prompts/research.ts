import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import {
  ResearchContextV2Schema,
  ResearchSynthesisLayerSchema,
  ResearchKnowledgeLayerSchema,
  ThesisDisciplineSchema,
  type ResearchContextV2,
  type PrimaryAngle,
  type ThesisDiscipline,
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
    '- Reference sources ONLY by their [S#] tags. A real sourceConnection MUST cite at least 2 different sources.',
    '- If there is only ONE source, set singleSource=true, lower synthesisConfidence, and produce internal implications/non-obvious angles instead of fabricating multi-source connections.',
    '- Use ONLY the provided source intelligence. Never invent facts, names, numbers, or events.',
    '- Label grounding honestly: "supported" (stated by sources), "inferred" (reasoned), "speculative" (a leap). Speculative leaps are valuable but MUST be labeled.',
    '- Optionally add expertPOV to a non-obvious insight: the conclusion a domain expert would draw (strategic/operational/prediction/practitioner). expertPOV is NEVER a fact — its grounding must be "inferred" or "speculative".',
    '- For contradictions, present BOTH sides and do not pick a winner; the disagreement itself is the story.',
    '- primaryAngle: nominate the SINGLE strongest, most interesting thesis as the narrative spine for downstream content. It must be a synthesized angle (a connection / tension / contradiction / non-obvious insight) — NOT a restatement of the loudest single source. Write thesis + a "reframe" hook seed ("the real story is X, not the obvious Y"), cite the sourceRefs it rests on, and label grounding (factual / inferred / speculative). A speculative spine is allowed and often best — just label it.',
    '- thesisDiscipline (inside primaryAngle): stress-test your own thesis like a senior analyst, NOT a fact-checker. Do not ask "is this true on the internet"; ask "even if the source facts are true, is THIS the best explanation, and how confidently may we state it?". Provide: supportLevel; supportingEvidence (each tagged strong/moderate/weak with refs); assumptions (and the risk if each is wrong); at least one strong counterArgument for any inferred/speculative thesis; alternativeExplanations (ordinary/competing reasons for the same facts, e.g. general industry growth or compliance pressure); overreachWarnings (claims the thesis tempts but the sources do NOT support, each with safer wording); and wordingGuidance (allowedStrength + requiredQualifiers + forbiddenPhrases). Be honest: a great thesis with a named weakness beats an overconfident one.',
    `- Write all natural-language text in ${language}. Proper nouns / product / company names may stay in their original language.`,
    '- Return ONLY the structured result via the tool. No prose, no markdown.',
  ].join('\n');
}

export function renderSynthesisContext(input: SynthesisInput): string {
  const byId = new Map(input.sourceRefs.map(r => [r.sourceId, r]));
  const all = [...input.primarySources, ...input.contextSources];
  const blocks = all.map(s => {
    const r = byId.get(s.id);
    const si = (s.sourceIntelligence as SI | null) ?? null;
    const claims = (si?.claims ?? []).map(c => (typeof c === 'string' ? c : c?.text ?? '')).filter(Boolean);
    const entities = (si?.entities ?? []).map(e => `${e?.name ?? ''}${e?.type ? ` (${e.type})` : ''}`).filter(Boolean);
    const topics = si?.mainTopics ?? si?.topics ?? [];
    return [
      `[${r?.ref}] "${s.label || s.type}" (${s.type}, ${r?.role})`,
      `  Summary: ${si?.summary ?? '(none)'}`,
      `  Topics: ${topics.join(', ') || '(none)'}`,
      `  Keywords: ${(si?.keywords ?? []).join(', ') || '(none)'}`,
      `  Claims: ${claims.length ? claims.map(c => `\n    - ${c}`).join('') : '(none)'}`,
      `  Entities: ${entities.join(', ') || '(none)'}`,
      `  Sentiment: ${si?.sentiment ?? 'neutral'}`,
    ].join('\n');
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

export const RESEARCH_TOOL: Anthropic.Tool = {
  name: 'record_research_synthesis',
  description: 'Record the cross-source research synthesis.',
  input_schema: {
    type: 'object',
    properties: {
      singleSource:        { type: 'boolean' },
      synthesisConfidence: { type: 'integer', minimum: 0, maximum: 100 },
      coreSubjects: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string' }, type: { type: 'string', enum: ['company','person','product','technology','concept','trend','organization','location'] },
        role: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['name','type','role','sourceRefs'] } },
      keyFacts: { type: 'array', items: { type: 'object', properties: {
        statement: { type: 'string' }, type: { type: 'string', enum: ['announcement','statistic','claim','definition','event','opinion','prediction'] },
        sourceRefs: { type: 'array', items: { type: 'string' } }, grounding: { type: 'string', enum: ['stated','implied'] },
        status: { type: 'string', enum: ['claimed','corroborated','disputed','unverified'] }, confidence: { type: 'integer', minimum: 0, maximum: 100 } },
        required: ['statement','type','sourceRefs','grounding','status','confidence'] } },
      mainStory: { type: 'object', properties: { headline: { type: 'string' }, summary: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['headline','summary','sourceRefs'] },
      supportingStories: { type: 'array', items: { type: 'object', properties: { headline: { type: 'string' }, summary: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['headline','summary','sourceRefs'] } },
      sourceConnections: { type: 'array', items: { type: 'object', properties: {
        description: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } },
        type: { type: 'string', enum: ['causal','analogical','sequential','tension','convergent','enabling'] },
        novelty: { type: 'integer', minimum: 0, maximum: 100 }, confidence: { type: 'integer', minimum: 0, maximum: 100 },
        grounding: { type: 'string', enum: groundingEnum } }, required: ['description','sourceRefs','type','novelty','confidence','grounding'] } },
      tensions: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, poles: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, sourceRefs: { type: 'array', items: { type: 'string' } } }, required: ['description','poles','sourceRefs'] } },
      contradictions: { type: 'array', items: { type: 'object', properties: {
        subject: { type: 'string' }, claimA: { type: 'string' }, claimB: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } },
        nature: { type: 'string', enum: ['factual','evidentiary','scope'] }, severity: { type: 'integer', minimum: 0, maximum: 100 }, resolution: { type: 'string' } },
        required: ['subject','claimA','claimB','sourceRefs','nature','severity','resolution'] } },
      secondOrderImplications: { type: 'array', items: { type: 'object', properties: {
        implication: { type: 'string' }, basis: { type: 'array', items: { type: 'string' } }, horizon: { type: 'string', enum: ['now','near','long'] },
        confidence: { type: 'integer', minimum: 0, maximum: 100 }, speculative: { type: 'boolean' } }, required: ['implication','basis','horizon','confidence','speculative'] } },
      nonObviousInsights: { type: 'array', items: { type: 'object', properties: {
        insight: { type: 'string' }, reasoning: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } },
        novelty: { type: 'integer', minimum: 0, maximum: 100 }, lens: { type: 'string', enum: ['analogical','second-order','contrarian','absence','stakeholder'] },
        speculative: { type: 'boolean' }, expertPOV: { type: 'object', properties: expertPOVProps, required: ['type','statement','grounding'] } },
        required: ['insight','reasoning','sourceRefs','novelty','lens','speculative'] } },
      openQuestions: { type: 'array', items: { type: 'string' } },
      // Phase 10B — nominate the SINGLE strongest thesis as the narrative spine.
      // Phase 10C — argue it at analyst level via thesisDiscipline.
      primaryAngle: { type: 'object', properties: {
        thesis:    { type: 'string', description: 'One-sentence narrative spine — the most interesting non-obvious story, not a source summary.' },
        reframe:   { type: 'string', description: 'A "the real story is X, not the obvious Y" hook seed for writers.' },
        basisKind: { type: 'string', enum: ['connection','tension','contradiction','insight','implication'] },
        sourceRefs:{ type: 'array', items: { type: 'string' } },
        grounding: { type: 'string', enum: ['factual','inferred','speculative'] },
        thesisDiscipline: { type: 'object', description: 'Stress-test the thesis. NOT fact-check (is it true?) but: even if the facts are true, is THIS the best explanation, and how strongly may we state it?', properties: {
          supportLevel: { type: 'string', enum: ['strong','moderate','weak'], description: 'How well the sources back the thesis overall.' },
          supportingEvidence: { type: 'array', items: { type: 'object', properties: {
            claim: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } }, strength: { type: 'string', enum: ['strong','moderate','weak'] } }, required: ['claim','sourceRefs','strength'] } },
          assumptions: { type: 'array', items: { type: 'object', properties: {
            assumption: { type: 'string' }, whyItMatters: { type: 'string' }, riskIfWrong: { type: 'string' } }, required: ['assumption','whyItMatters','riskIfWrong'] } },
          counterArguments: { type: 'array', description: 'The strongest objections to the thesis. Provide at least one for any inferred/speculative thesis.', items: { type: 'object', properties: {
            argument: { type: 'string' }, sourceRefs: { type: 'array', items: { type: 'string' } }, strength: { type: 'string', enum: ['strong','moderate','weak'] } }, required: ['argument','strength'] } },
          alternativeExplanations: { type: 'array', description: 'Other plausible explanations for the same facts (e.g. ordinary industry growth, compliance pressure).', items: { type: 'object', properties: {
            explanation: { type: 'string' }, whyPlausible: { type: 'string' } }, required: ['explanation','whyPlausible'] } },
          overreachWarnings: { type: 'array', description: 'Claims the thesis tempts but the sources do NOT support — with safer wording.', items: { type: 'object', properties: {
            riskyClaim: { type: 'string' }, saferWording: { type: 'string' }, reason: { type: 'string' } }, required: ['riskyClaim','saferWording','reason'] } },
          wordingGuidance: { type: 'object', properties: {
            allowedStrength: { type: 'string', enum: ['assertive','balanced','cautious','speculative'] },
            requiredQualifiers: { type: 'array', items: { type: 'string' } },
            forbiddenPhrases: { type: 'array', items: { type: 'string' } } }, required: ['allowedStrength','requiredQualifiers','forbiddenPhrases'] },
        }, required: ['supportLevel','supportingEvidence','assumptions','counterArguments','alternativeExplanations','overreachWarnings','wordingGuidance'] },
      }, required: ['thesis','reframe','basisKind','sourceRefs','grounding','thesisDiscipline'] },
    },
    required: ['singleSource','synthesisConfidence','mainStory','sourceConnections','nonObviousInsights','openQuestions','primaryAngle'],
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
  return out.slice(0, 3);
}

const FORBIDDEN = ['definitely', 'guarantees', 'will replace', 'completely solves', 'eliminates entirely', 'destroys', 'proves that', 'inevitably'];

function buildThesisDiscipline(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
  base: PrimaryAngle,
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

  // 1) Use Claude's nomination when it validates; sanitize refs, then ensure a
  //    counter-argument exists for any non-factual thesis.
  const nom = (raw.primaryAngle as Record<string, unknown> | undefined)?.thesisDiscipline;
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
      if (base.grounding !== 'factual' && d.counterArguments.length === 0) d.counterArguments = deriveCounters(synthesis);
      return d;
    }
  }

  // 2) Deterministic fallback assembled from the synthesis.
  return {
    supportLevel,
    supportingEvidence: base.supportingFacts.slice(0, 5).map(f => ({ claim: f, sourceRefs: base.synthesisBasis.sourceRefs, strength: 'moderate' as const })),
    assumptions: [],
    counterArguments: deriveCounters(synthesis),
    alternativeExplanations: synthesis.openQuestions.slice(0, 2).map(q => ({ explanation: q, whyPlausible: 'Raised as an open question by the synthesis — a competing reading the thesis does not rule out.' })),
    overreachWarnings: [],
    wordingGuidance: { allowedStrength, requiredQualifiers, forbiddenPhrases: FORBIDDEN },
  };
}

/** Select the narrative spine (10B) AND attach its analyst-level discipline (10C). */
export function selectPrimaryAngle(
  raw: Record<string, unknown>,
  synthesis: SynthesisLayer,
  knowledge: KnowledgeLayer,
  meta: Meta,
): PrimaryAngle {
  const base = selectAngleBase(raw, synthesis, knowledge, meta);
  return { ...base, thesisDiscipline: buildThesisDiscipline(raw, synthesis, knowledge, meta, base) };
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

  // Phase 10B — choose the narrative spine and attach it to the synthesis layer.
  const primaryAngle = selectPrimaryAngle(raw, synthesis, knowledge, meta);

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
    synthesis: { ...synthesis, primaryAngle },
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
    },
  };
  return ResearchContextV2Schema.parse(v2);
}
