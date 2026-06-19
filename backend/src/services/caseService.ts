import type { Prisma, ContentSource, ContentOutput, PipelineStep, PipelineRun } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateCaseInput, UpdateCaseInput } from '../schemas/caseSchemas';

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
    body:               o.body,            // = readyToPublish (editable)
    readyToPublish:     o.body,            // explicit v2 alias
    breakdown:          o.breakdown ?? null,   // read-only; null on legacy v1
    metadata:           o.metadata ?? null,
    status:             o.status,
    version:            o.version,
    contentScore:       o.contentScore,
    researchConfidence: o.researchConfidence,
    factCheckAccuracy:  o.factCheckAccuracy,
    generatedAt:        o.generatedAt.toISOString(),
    reviewedAt:         o.reviewedAt ? o.reviewedAt.toISOString() : null,
  };
}

// Phase 10D.0 — research integrity, derived from the run's stored researchContext.
// success = real synthesis (research-1); degraded = mock-fallback (FAILURE);
// mock = deterministic mock because synthesis is disabled (expected, not a failure).
export function researchIntegrity(researchContext: unknown) {
  const rc = researchContext as {
    meta?: { degraded?: boolean; generatorVersion?: string };
    synthesis?: { thesisCompetition?: { candidates?: unknown[] } };
  } | null;
  if (!rc?.meta) return null;
  const gv = rc.meta.generatorVersion ?? 'unknown';
  const degraded = rc.meta.degraded === true;
  const candidateCount = Array.isArray(rc.synthesis?.thesisCompetition?.candidates)
    ? rc.synthesis!.thesisCompetition!.candidates!.length : 0;
  const status: 'success' | 'degraded' | 'mock' =
    degraded ? 'degraded' : gv === 'research-1' ? 'success' : 'mock';
  return {
    status,
    degraded,
    generatorVersion: gv,
    // The thesis competition only truly ran on real synthesis with >1 competed candidate.
    competitionRan: status === 'success' && candidateCount > 1,
    candidateCount,
  };
}

// The winning thesis (narrative spine) for a run — the one-sentence primaryAngle
// chosen by the synthesis service. Null on legacy/mock runs that have no
// synthesis.primaryAngle. Surfaced so the Review page can show the editorial thesis.
export function runThesis(researchContext: unknown): string | null {
  const rc = researchContext as { synthesis?: { primaryAngle?: { thesis?: unknown } } } | null;
  const t = rc?.synthesis?.primaryAngle?.thesis;
  return typeof t === 'string' && t.trim().length > 0 ? t.trim() : null;
}

function serializePipelineStep(s: PipelineStep, research: ReturnType<typeof researchIntegrity> = null) {
  return {
    id:          s.id,
    name:        s.name,
    status:      s.status,
    startedAt:   s.startedAt   ? s.startedAt.toISOString()   : null,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    summary:     s.summary,
    confidence:  s.confidence,
    research,   // Phase 10D.0 — present on the research step only
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
    research:         researchIntegrity(r.researchContext),   // Phase 10D.0 — pipeline-level
    thesis:           runThesis(r.researchContext),           // the winning narrative spine
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
    // Phase 10D.0 — attach research integrity to the research step so the UI can
    // render SUCCESS / DEGRADED and the competition-ran status at step level.
    pipeline:   sortedSteps.map(s => serializePipelineStep(s, s.name === 'research' && latestRun ? researchIntegrity(latestRun.researchContext) : null)),
    currentRun: latestRun ? serializeRun(latestRun) : null,
    createdAt:  c.createdAt.toISOString(),
    updatedAt:  c.updatedAt.toISOString(),
  };
}

// ── Service methods ───────────────────────────────────────────────────────────

export const caseService = {

  // Phase 12 — STRICT ownership: only the authenticated user's cases are returned.
  async listCases(userId: string) {
    const cases = await prisma.contentCase.findMany({
      where: { userId },
      include: caseInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return cases.map(serializeCase);
  },

  // Ownership of :id routes is enforced upstream by requireCaseOwnership; we also
  // pass userId so the query itself is scoped (defense in depth).
  async getCaseById(id: string, userId: string) {
    const c = await prisma.contentCase.findFirst({
      where: { id, userId },
      include: caseInclude,
    });
    return c ? serializeCase(c) : null;
  },

  async createCase(data: CreateCaseInput, userId: string) {
    const c = await prisma.$transaction(async tx => {
      return tx.contentCase.create({
        data: {
          userId,
          title:           data.title,
          language:        data.language,
          // Simplified wizard fields
          contentGoal:     data.contentGoal,
          goalCustom:      data.goalCustom || null,
          contentStyle:    data.contentStyle,
          styleCustom:     data.styleCustom || null,
          contentTargets:  data.contentTargets,
          // Schedule config (Phase 8.6) — columns already existed in the schema
          scheduleFrequency:  data.scheduleFrequency  ?? 'manual',
          scheduleTime:       data.scheduleTime       ?? null,
          scheduleDayOfWeek:  data.scheduleDayOfWeek  ?? null,
          scheduleDayOfMonth: data.scheduleDayOfMonth ?? null,
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
    // Schedule config (Phase 8.6)
    if (data.scheduleFrequency  !== undefined) patch.scheduleFrequency  = data.scheduleFrequency;
    if (data.scheduleTime       !== undefined) patch.scheduleTime       = data.scheduleTime;
    if (data.scheduleDayOfWeek  !== undefined) patch.scheduleDayOfWeek  = data.scheduleDayOfWeek;
    if (data.scheduleDayOfMonth !== undefined) patch.scheduleDayOfMonth = data.scheduleDayOfMonth;

    // Schedule re-edit (Task 3.4): when the schedule ACTUALLY changes, clear the
    // scheduler's "already processed this slot" key so the new schedule isn't blocked
    // by a stale slot key. Compare provided fields against the stored values so an
    // unrelated settings edit (goal/style/language/targets) never resets the key — and
    // a no-op save of the same schedule doesn't clear it either. This does NOT trigger
    // generation (updateCase never runs the pipeline); the scheduler acts on its own tick.
    const scheduleKeys = ['scheduleFrequency', 'scheduleTime', 'scheduleDayOfWeek', 'scheduleDayOfMonth'] as const;
    const scheduleProvided = scheduleKeys.some(k => data[k] !== undefined);
    if (scheduleProvided) {
      const current = await prisma.contentCase.findUnique({
        where: { id },
        select: { scheduleFrequency: true, scheduleTime: true, scheduleDayOfWeek: true, scheduleDayOfMonth: true },
      });
      const changed = current != null && scheduleKeys.some(k => data[k] !== undefined && data[k] !== current[k]);
      if (changed) patch.lastScheduledSlotKey = null;
    }
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
