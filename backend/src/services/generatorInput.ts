import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import {
  ResearchContextSchema,
  ResearchContextV2Schema,
  FactCheckReportSchema,
  type GeneratorInput,
  type ContentPlatform,
  type ResearchContextV2,
} from '../schemas/aiContractSchemas';
import { resolveVoiceProfile } from './voice/voiceProfileResolver';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4A.2 — coherence-aware evidence scoping.
//
// When Research flagged the source set as low-coherence (the gate fired: the
// winning thesis intentionally used ONE cluster and dropped the rest), the
// generator must see ONLY the winning cluster's evidence — otherwise dropped
// sources reappear as "supporting facts" / "verified" claims. High-coherence runs
// keep the all-source behavior exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type CoherenceLike = { label?: string; forcedSynthesisRisk?: string } | null | undefined;

export function isLowCoherence(c: CoherenceLike): boolean {
  if (!c) return false;
  return c.label === 'low' || c.label === 'multi-topic' || c.forcedSynthesisRisk === 'high';
}

const dedupeStr = (a: string[]): string[] => [...new Set(a.filter(Boolean))];
const normFact = (s: string): string => s.toLowerCase().replace(/[^a-z0-9֐-׿ ]/gi, '').replace(/\s+/g, ' ').trim();

// Drop claims whose normalized text overlaps a normalized out-of-scope keyFact
// statement (either contains the other). Length guard avoids trivial matches.
export function dropOutOfScope<T extends { claim: string }>(items: T[], outOfScopeStatements: string[]): T[] {
  const outNorms = dedupeStr(outOfScopeStatements.map(normFact)).filter(s => s.length >= 12);
  if (outNorms.length === 0) return items;
  return items.filter(it => {
    const c = normFact(it.claim);
    return c.length === 0 || !outNorms.some(o => c.includes(o) || o.includes(c));
  });
}

interface CoherenceScope {
  importantClaims: string[];
  mainTopics: string[];
  keyInsights: string[];
  outOfScopeStatements: string[];
  scopedSources: ContentSource[];
}

// Build the in-scope projection from the v2 structured layers (which carry source
// refs) + the run sources. Returns null when there is nothing to scope to.
function computeCoherenceScope(rcV2: ResearchContextV2, inScopeRefs: string[], runSources: ContentSource[]): CoherenceScope | null {
  if (inScopeRefs.length === 0) return null;
  const inSet = new Set(inScopeRefs);
  const k = rcV2.knowledge;
  const s = rcV2.synthesis;
  const inFacts = k.keyFacts.filter(f => f.sourceRefs.some(r => inSet.has(r)));
  const outFacts = k.keyFacts.filter(f => !f.sourceRefs.some(r => inSet.has(r)));
  const inSubjects = k.coreSubjects.filter(c => c.sourceRefs.some(r => inSet.has(r)));
  const inInsights = s.nonObviousInsights.filter(n => n.sourceRefs.some(r => inSet.has(r)));
  const inConns = s.sourceConnections.filter(c => c.sourceRefs.some(r => inSet.has(r)));
  const inScopeSourceIds = new Set(rcV2.meta.sourceRefMap.filter(m => inSet.has(m.ref)).map(m => m.sourceId));
  return {
    importantClaims: dedupeStr(inFacts.map(f => f.statement)).slice(0, 8),
    mainTopics: dedupeStr(inSubjects.map(c => c.name)).slice(0, 10),
    keyInsights: dedupeStr([...inInsights.map(n => n.insight), ...inConns.map(c => c.description)]).slice(0, 10),
    outOfScopeStatements: outFacts.map(f => f.statement),
    scopedSources: runSources.filter(src => inScopeSourceIds.has(src.id)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator Input projection (Phase 9)
//
// Builds the curated, deduped projection every content generator receives.
// Generators NEVER see raw article text — only Research Context, Fact Check
// Report, and aggregated Source Intelligence. Built once per (run, platform).
// ─────────────────────────────────────────────────────────────────────────────

const GENERATOR_VERSION = 'gen-1';

// Per-platform knobs (hashtag bounds per product decision).
export const PLATFORM_CONFIG: Record<ContentPlatform, Record<string, unknown>> = {
  linkedin:   { maxHashtags: 3, takeawayCount: [3, 5] },
  facebook:   { maxHashtags: 2, requireCommunityQuestion: true, allowFirstPerson: true },
  newsletter: { computeReadingTime: true, subjectMaxChars: 120, previewMaxChars: 150, wordTarget: [600, 900] },
};

function resolveLang(run: PipelineRun, c: ContentCase): 'en' | 'he' {
  if (run.outputLanguage === 'he') return 'he';
  if (run.outputLanguage === 'en') return 'en';
  return c.language === 'he' ? 'he' : 'en';
}

// Normalize a possibly-null/blank case field to a trimmed value or undefined, so
// empty legacy fields are omitted from the rendered prompt rather than printed blank.
function clean(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : undefined;
}

// Shape-tolerant source-intelligence aggregation (new + legacy shapes).
type SI = {
  entities?: { name: string; type?: string }[];
  keywords?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  mainTopics?: string[];
  contentAngles?: string[];
};

function aggregateSources(sources: ContentSource[]): GeneratorInput['sources'] {
  const entityMap = new Map<string, { name: string; type: string }>();
  const keywords = new Set<string>();
  const angles = new Set<string>();
  let pos = 0, neg = 0, neu = 0, mix = 0;

  for (const s of sources) {
    const si = (s.sourceIntelligence as SI | null) ?? null;
    if (!si) continue;
    for (const e of si.entities ?? []) {
      if (e?.name && !entityMap.has(e.name)) entityMap.set(e.name, { name: e.name, type: e.type ?? 'organization' });
    }
    for (const k of si.keywords ?? []) keywords.add(k);
    for (const a of si.contentAngles ?? []) angles.add(a);
    switch (si.sentiment) {
      case 'positive': pos++; break;
      case 'negative': neg++; break;
      case 'mixed':    mix++; break;
      default:         neu++; break;
    }
  }

  const sentiment: GeneratorInput['sources']['sentiment'] =
    mix > 0 || (pos > 0 && neg > 0) ? 'mixed'
    : pos > neg && pos > neu ? 'positive'
    : neg > pos && neg > neu ? 'negative'
    : 'neutral';

  return {
    entities:      [...entityMap.values()].slice(0, 20),
    keywords:      [...keywords].slice(0, 15),
    sentiment,
    contentAngles: [...angles].slice(0, 6),
    sourceCount:   sources.length,
  };
}

/**
 * Build the projection for a single platform. Throws only if research/fact-check
 * artifacts are missing/invalid (a real pipeline fault the caller already guards).
 */
export function buildGeneratorInput(
  platform: ContentPlatform,
  run: PipelineRun,
  caseItem: ContentCase,
  runSources: ContentSource[],
): GeneratorInput {
  const rc = ResearchContextSchema.parse(run.researchContext);
  const fcr = FactCheckReportSchema.parse(run.factCheckReport);

  // Phase 10B — surface the narrative spine when the research is a v2 synthesis.
  // Backward-compatible: v1-only runs have no primaryAngle → flat-menu behavior.
  const rcV2 = ResearchContextV2Schema.safeParse(run.researchContext);
  const primaryAngle = rcV2.success ? rcV2.data.synthesis.primaryAngle : undefined;

  // Phase 10D.0 — propagate research degradation into the content contract so it
  // lands on every output's metadata (claude-gen-1 on mock research must show it).
  const researchGeneratorVersion = rcV2.success ? rcV2.data.meta.generatorVersion : undefined;
  const researchDegraded = rcV2.success ? rcV2.data.meta.degraded === true : false;

  // Phase 4A.2 — coherence scoping. Only when research flagged low coherence AND a
  // v2 winner exists do we scope evidence to the winner's cluster.
  const coherenceMeta = rcV2.success ? rcV2.data.meta.coherence : undefined;
  const lowCoherence = isLowCoherence(coherenceMeta);
  const inScopeRefs = lowCoherence && primaryAngle ? primaryAngle.synthesisBasis.sourceRefs : [];
  const scope = lowCoherence && rcV2.success
    ? computeCoherenceScope(rcV2.data, inScopeRefs, runSources)
    : null;

  // Fact-check lists, scoped to the winning cluster in low-coherence cases so dropped
  // sources' claims are never presented as safe-to-state material.
  const verifiedItems   = fcr.verifiedClaims.slice(0, 15).map(c => ({ claim: c.claim, confidenceScore: c.confidenceScore }));
  const uncertainItems  = fcr.uncertainClaims.slice(0, 10).map(c => ({ claim: c.claim, note: c.notes }));
  const conflictItems   = fcr.conflictingClaims.map(c => ({ claim: c.claim }));
  const unsupportItems  = (fcr.unsupportedClaims ?? []).slice(0, 10).map(c => ({ claim: c.claim }));
  const scopeFacts = <T extends { claim: string }>(items: T[]): T[] => (scope ? dropOutOfScope(items, scope.outOfScopeStatements) : items);

  return {
    contract: {
      platform,
      outputLanguage:   resolveLang(run, caseItem),
      generatorVersion: GENERATOR_VERSION,
      runId:            run.id,
      caseId:           caseItem.id,
      researchDegraded,
      researchGeneratorVersion,
    },
    brief: {
      caseTitle:    caseItem.title,
      contentGoal:  caseItem.contentGoal as unknown as string,
      goalCustom:   clean(caseItem.goalCustom),
      contentStyle: caseItem.contentStyle as unknown as string,
      styleCustom:  clean(caseItem.styleCustom),
      // Phase 1 — plumb the remaining user-defined voice settings. These already
      // live on the case (settable via case update) but never reached the
      // generator. Blank legacy fields normalize to undefined and are not rendered.
      targetAudience: clean(caseItem.targetAudience),
      writingStyle:   clean(caseItem.writingStyle),
      goals:          clean(caseItem.goals),
      language:       resolveLang(run, caseItem),
      aiInstructions: clean(caseItem.aiInstructions),
    },
    research: {
      summary:         rc.summary,
      // Phase 4A.2 — scoped to the winning cluster when low coherence (the spine's
      // SUPPORTING MATERIAL pulls from these; summary is not rendered when a
      // primaryAngle exists, which is always the case for low coherence).
      mainTopics:      scope ? scope.mainTopics      : rc.mainTopics.slice(0, 10),
      keyInsights:     scope ? scope.keyInsights     : rc.keyInsights.slice(0, 10),
      importantClaims: scope ? scope.importantClaims : rc.importantClaims.slice(0, 8),
      suggestedAngles: rc.suggestedAngles.slice(0, 6),
      suggestedHooks:  rc.suggestedHooks.slice(0, 5),
      contradictions:  rc.contradictions,
      risks:           rc.risks,
      confidenceScore: rc.confidenceScore,
      primaryAngle,
    },
    facts: {
      verified:    scopeFacts(verifiedItems),
      uncertain:   scopeFacts(uncertainItems),
      conflicting: scopeFacts(conflictItems).map(c => c.claim),
      // Phase 3B — unsupported claims (never state as fact); editorial integrity
      // notes are merged into warnings so the generator sees them.
      unsupported: scopeFacts(unsupportItems).map(c => c.claim),
      warnings:    [...fcr.warnings, ...(fcr.editorialWarnings ?? [])],
      overallConfidenceScore: fcr.overallConfidenceScore,
    },
    // Phase 4A.2 — aggregate intelligence from the in-scope sources only when low coherence.
    sources: aggregateSources(scope ? scope.scopedSources : runSources),
    coherence: coherenceMeta
      ? { label: coherenceMeta.label, forcedSynthesisRisk: coherenceMeta.forcedSynthesisRisk, lowCoherence, inScopeSourceRefs: inScopeRefs }
      : undefined,
    // Phase 2B — deterministic structural voice resolved from the case settings.
    // ContentCase is VoiceCaseInput-compatible. Governs HOW the piece is built;
    // never relaxes the fact floor.
    voiceProfile: resolveVoiceProfile(caseItem),
    policy: {
      factDiscipline:     'only-provided-facts',
      unverifiedHandling: 'hedge-or-omit',
      forbidConflicting:  true,
      languageStrict:     true,
      noFabricatedStats:  true,
    },
    platformConfig: PLATFORM_CONFIG[platform],
  };
}
