import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import {
  ResearchContextV2Schema,
  ResearchSynthesisLayerSchema,
  ResearchKnowledgeLayerSchema,
  type ResearchContextV2,
} from '../schemas/aiContractSchemas';
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
    },
    required: ['singleSource','synthesisConfidence','mainStory','sourceConnections','nonObviousInsights','openQuestions'],
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
    synthesis,
  };

  return ResearchContextV2Schema.parse(v2);
}

/** v2-valid stub from the permanent v1 mock — disabled path and fallback. */
export function buildV2Stub(input: SynthesisInput, generatorVersion: string, degraded: boolean): ResearchContextV2 {
  const v1 = generateResearchContext(input.run, input.caseItem, input.primarySources, input.contextSources);
  const singleSource = input.sourceRefs.length <= 1;
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
    },
  };
  return ResearchContextV2Schema.parse(v2);
}
