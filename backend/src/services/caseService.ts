import type { Prisma, ContentSource, ContentOutput, PipelineStep, PipelineRun } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateCaseInput, UpdateCaseInput } from '../schemas/caseSchemas';

// Hard-coded until authentication is added in a future phase.
const DEV_USER_ID = 'user-seed-1';

// Canonical pipeline step order — matches the frontend's PipelineStep[] expectation.
const PIPELINE_STEP_ORDER = ['research', 'fact_check', 'content_creation'] as const;
type StepName = typeof PIPELINE_STEP_ORDER[number];

// ── Prisma include shape for a full case response ─────────────────────────────

const caseInclude = {
  sources:       { orderBy: { createdAt: 'desc' as const } },
  outputs:       { orderBy: { generatedAt: 'desc' as const } },
  pipelineSteps: true,
  // Include only the most recent run for the currentRun summary
  pipelineRuns:  { orderBy: { startedAt: 'desc' as const }, take: 1 },
} satisfies Prisma.ContentCaseInclude;

type FullCase = Prisma.ContentCaseGetPayload<{ include: typeof caseInclude }>;

// ── Serializers — transform Prisma records to frontend ContentCase shape ──────

export function serializeSource(s: ContentSource) {
  return {
    id:                  s.id,
    contentCaseId:       s.contentCaseId,
    type:                s.type,
    label:               s.label,
    content:             s.content,
    status:              s.status,
    usedInRunId:         s.usedInRunId,
    lastUsedAt:          s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
    sourceIntelligence:  s.sourceIntelligence ?? null,
    // URL content extraction (Phase 8.5)
    extractedTitle:      s.extractedTitle ?? null,
    extractedText:       s.extractedText ?? null,
    extractionStatus:    s.extractionStatus ?? null,
    extractionError:     s.extractionError ?? null,
    extractedAt:         s.extractedAt ? s.extractedAt.toISOString() : null,
    createdAt:           s.createdAt.toISOString(),
    updatedAt:           s.updatedAt ? s.updatedAt.toISOString() : null,
  };
}

function serializeOutput(o: ContentOutput) {
  return {
    id:                 o.id,
    contentCaseId:      o.contentCaseId,
    pipelineRunId:      o.pipelineRunId,
    platform:           o.platform,
    title:              o.title,
    body:               o.body,
    status:             o.status,
    version:            o.version,
    contentScore:       o.contentScore,
    researchConfidence: o.researchConfidence,
    factCheckAccuracy:  o.factCheckAccuracy,
    generatedAt:        o.generatedAt.toISOString(),
    reviewedAt:         o.reviewedAt ? o.reviewedAt.toISOString() : null,
  };
}

function serializePipelineStep(s: PipelineStep) {
  return {
    id:          s.id,
    name:        s.name,
    status:      s.status,
    startedAt:   s.startedAt   ? s.startedAt.toISOString()   : null,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    summary:     s.summary,
    confidence:  s.confidence,
  };
}

function serializeRun(r: PipelineRun) {
  return {
    id:               r.id,
    status:           r.status,
    primarySourceIds: r.primarySourceIds,
    contextSourceIds: r.contextSourceIds,
    sourceCount:      r.sourceCount,
    startedAt:        r.startedAt.toISOString(),
    completedAt:      r.completedAt ? r.completedAt.toISOString() : null,
  };
}

export function serializeCase(c: FullCase) {
  const sortedSteps = [...c.pipelineSteps].sort(
    (a, b) =>
      PIPELINE_STEP_ORDER.indexOf(a.name as StepName) -
      PIPELINE_STEP_ORDER.indexOf(b.name as StepName),
  );

  const latestRun = c.pipelineRuns[0] ?? null;

  return {
    id:              c.id,
    title:           c.title,
    status:          c.status,
    language:        c.language,
    // Legacy fields — present on old cases; empty string on new ones
    targetAudience:  c.targetAudience,
    industry:        c.industry,
    experienceLevel: c.experienceLevel,
    writingStyle:    c.writingStyle,
    goals:           c.goals,
    aiInstructions:  c.aiInstructions,
    schedule: {
      frequency:   c.scheduleFrequency,
      time:        c.scheduleTime,
      dayOfWeek:   c.scheduleDayOfWeek,
      dayOfMonth:  c.scheduleDayOfMonth,
    },
    // Simplified wizard fields
    contentGoal:    c.contentGoal,
    goalCustom:     c.goalCustom,
    contentStyle:   c.contentStyle,
    styleCustom:    c.styleCustom,
    contentTargets: c.contentTargets,
    sources:    c.sources.map(serializeSource),
    outputs:    c.outputs.map(serializeOutput),
    pipeline:   sortedSteps.map(serializePipelineStep),
    currentRun: latestRun ? serializeRun(latestRun) : null,
    createdAt:  c.createdAt.toISOString(),
    updatedAt:  c.updatedAt.toISOString(),
  };
}

// ── Service methods ───────────────────────────────────────────────────────────

export const caseService = {

  async listCases() {
    const cases = await prisma.contentCase.findMany({
      include: caseInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return cases.map(serializeCase);
  },

  async getCaseById(id: string) {
    const c = await prisma.contentCase.findUnique({
      where: { id },
      include: caseInclude,
    });
    return c ? serializeCase(c) : null;
  },

  async createCase(data: CreateCaseInput) {
    const c = await prisma.$transaction(async tx => {
      return tx.contentCase.create({
        data: {
          userId:          DEV_USER_ID,
          title:           data.title,
          language:        data.language,
          // Simplified wizard fields
          contentGoal:     data.contentGoal,
          goalCustom:      data.goalCustom || null,
          contentStyle:    data.contentStyle,
          styleCustom:     data.styleCustom || null,
          contentTargets:  data.contentTargets,
          // Legacy fields default to empty for new wizard cases
          pipelineSteps: {
            create: PIPELINE_STEP_ORDER.map(name => ({
              name,
              status: 'idle' as const,
            })),
          },
        },
        include: caseInclude,
      });
    });

    return serializeCase(c);
  },

  async updateCase(id: string, data: UpdateCaseInput) {
    const patch: Prisma.ContentCaseUpdateInput = {};

    // Simplified wizard fields
    if (data.contentGoal    !== undefined) patch.contentGoal    = data.contentGoal;
    if (data.goalCustom     !== undefined) patch.goalCustom     = data.goalCustom || null;
    if (data.contentStyle   !== undefined) patch.contentStyle   = data.contentStyle;
    if (data.styleCustom    !== undefined) patch.styleCustom    = data.styleCustom || null;
    if (data.contentTargets !== undefined) patch.contentTargets = data.contentTargets;
    if (data.language       !== undefined) patch.language       = data.language;
    if (data.title          !== undefined) patch.title          = data.title;
    // Legacy fields (old wizard — kept for backward compat)
    if (data.targetAudience  !== undefined) patch.targetAudience  = data.targetAudience;
    if (data.industry        !== undefined) patch.industry        = data.industry;
    if (data.experienceLevel !== undefined) patch.experienceLevel = data.experienceLevel;
    if (data.writingStyle    !== undefined) patch.writingStyle    = data.writingStyle;
    if (data.goals           !== undefined) patch.goals           = data.goals;
    if (data.aiInstructions  !== undefined) patch.aiInstructions  = data.aiInstructions;

    const c = await prisma.contentCase.update({
      where: { id },
      data: patch,
      include: caseInclude,
    });
    return serializeCase(c);
  },

  async deleteCase(id: string) {
    await prisma.contentCase.delete({ where: { id } });
  },
};
