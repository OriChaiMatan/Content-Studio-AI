import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import {
  ResearchContextSchema,
  ResearchContextV2Schema,
  FactCheckReportSchema,
  type GeneratorInput,
  type ContentPlatform,
} from '../schemas/aiContractSchemas';

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
      goalCustom:   caseItem.goalCustom ?? undefined,
      contentStyle: caseItem.contentStyle as unknown as string,
      styleCustom:  caseItem.styleCustom ?? undefined,
    },
    research: {
      summary:         rc.summary,
      mainTopics:      rc.mainTopics.slice(0, 10),
      keyInsights:     rc.keyInsights.slice(0, 10),
      importantClaims: rc.importantClaims.slice(0, 8),
      suggestedAngles: rc.suggestedAngles.slice(0, 6),
      suggestedHooks:  rc.suggestedHooks.slice(0, 5),
      contradictions:  rc.contradictions,
      risks:           rc.risks,
      confidenceScore: rc.confidenceScore,
      primaryAngle,
    },
    facts: {
      verified:    fcr.verifiedClaims.slice(0, 15).map(c => ({ claim: c.claim, confidenceScore: c.confidenceScore })),
      uncertain:   fcr.uncertainClaims.slice(0, 10).map(c => ({ claim: c.claim, note: c.notes })),
      conflicting: fcr.conflictingClaims.map(c => c.claim),
      warnings:    fcr.warnings,
      overallConfidenceScore: fcr.overallConfidenceScore,
    },
    sources: aggregateSources(runSources),
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
