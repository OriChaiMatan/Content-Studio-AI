import { prisma } from '../lib/prisma';
import { serializeCase, serializeSource } from './caseService';
import { PIPELINE_STEP_ORDER, STEP_SUMMARIES } from '../schemas/pipelineSchemas';

// ── Source selection ───────────────────────────────────────────────────────────

function partitionSources(sources: { id: string; status: string }[]) {
  return {
    primary: sources.filter(s => s.status === 'new').map(s => s.id),
    context: sources.filter(s => s.status === 'used').map(s => s.id),
    // ignored and error sources are excluded from both lists
  };
}

// ── Shared include for returning a full case ───────────────────────────────────

const caseInclude = {
  sources:       { orderBy: { createdAt: 'desc' as const } },
  outputs:       { orderBy: { generatedAt: 'desc' as const } },
  pipelineSteps: true,
  pipelineRuns:  { orderBy: { startedAt: 'desc' as const }, take: 1 },
} as const;

// ── Pipeline service ───────────────────────────────────────────────────────────

export const pipelineService = {

  // ── GET pipeline status ──────────────────────────────────────────────────────
  // Lightweight endpoint for polling — returns steps + current run + source counts.
  async getStatus(caseId: string) {
    const caseRecord = await prisma.contentCase.findUnique({
      where: { id: caseId },
      select: {
        pipelineSteps: true,
        pipelineRuns:  { orderBy: { startedAt: 'desc' as const }, take: 1 },
        sources:       { select: { status: true } },
      },
    });
    if (!caseRecord) return null;

    const latestRun = caseRecord.pipelineRuns[0] ?? null;

    return {
      steps: caseRecord.pipelineSteps.map(s => ({
        id:          s.id,
        name:        s.name,
        status:      s.status,
        startedAt:   s.startedAt   ? s.startedAt.toISOString()   : null,
        completedAt: s.completedAt ? s.completedAt.toISOString() : null,
        summary:     s.summary,
        confidence:  s.confidence,
      })),
      currentRun: latestRun ? {
        id:               latestRun.id,
        status:           latestRun.status,
        primarySourceIds: latestRun.primarySourceIds,
        contextSourceIds: latestRun.contextSourceIds,
        sourceCount:      latestRun.sourceCount,
        startedAt:        latestRun.startedAt.toISOString(),
        completedAt:      latestRun.completedAt ? latestRun.completedAt.toISOString() : null,
      } : null,
      newSourceCount:  caseRecord.sources.filter(s => s.status === 'new').length,
      usedSourceCount: caseRecord.sources.filter(s => s.status === 'used').length,
    };
  },

  // ── Start a new pipeline run ─────────────────────────────────────────────────
  // Returns: { type: 'ok', case } | { type: 'error', code, message }
  async startRun(caseId: string) {
    // Guard: case must exist
    const existing = await prisma.contentCase.findUnique({
      where: { id: caseId },
      include: {
        sources:       true,
        pipelineSteps: true,
        pipelineRuns:  { where: { status: 'running' }, take: 1 },
      },
    });
    if (!existing) {
      return { type: 'error', code: 'case_not_found', message: 'Case not found.' } as const;
    }

    // Guard: no active run already in progress
    if (existing.pipelineRuns.length > 0) {
      return { type: 'error', code: 'already_running', message: 'A pipeline run is already in progress for this case.' } as const;
    }

    // Select sources by lifecycle status
    const { primary: primarySourceIds, context: contextSourceIds } = partitionSources(existing.sources);

    // Guard: must have at least one new source as primary material
    if (primarySourceIds.length === 0) {
      return {
        type: 'error',
        code: 'no_new_sources',
        message: 'No new sources are available for this case. Add new sources or reuse existing ones.',
      } as const;
    }

    // Create run + reset steps + set case status — all in one transaction
    const updatedCase = await prisma.$transaction(async tx => {
      // Create the PipelineRun with source selection snapshot
      await tx.pipelineRun.create({
        data: {
          contentCaseId:   caseId,
          triggeredBy:     'manual',
          status:          'running',
          primarySourceIds,
          contextSourceIds,
          sourceCount:     primarySourceIds.length + contextSourceIds.length,
        },
      });

      // Reset all 3 pipeline steps to idle, then set research to running
      await tx.pipelineStep.updateMany({
        where: { contentCaseId: caseId },
        data:  { status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
      });
      await tx.pipelineStep.updateMany({
        where: { contentCaseId: caseId, name: 'research' },
        data:  { status: 'running', startedAt: new Date() },
      });

      // Delete only draft/rejected outputs from previous runs.
      // Approved outputs are permanently in the Library and must never be removed.
      await tx.contentOutput.deleteMany({
        where: { contentCaseId: caseId, status: { not: 'approved' } },
      });

      // Advance case status
      await tx.contentCase.update({
        where: { id: caseId },
        data:  { status: 'research', updatedAt: new Date() },
      });

      return tx.contentCase.findUniqueOrThrow({
        where: { id: caseId },
        include: caseInclude,
      });
    });

    return { type: 'ok', case: serializeCase(updatedCase) } as const;
  },

  // ── Advance the current run one step ─────────────────────────────────────────
  // Completes the currently-running step; starts the next one.
  // When content_creation finishes: creates mock outputs, completes the run.
  // Sources are NOT marked as used here — that happens in Phase 5 on approval.
  async advanceRun(caseId: string) {
    const existing = await prisma.contentCase.findUnique({
      where: { id: caseId },
      include: {
        pipelineSteps: true,
        pipelineRuns:  { where: { status: 'running' }, orderBy: { startedAt: 'desc' as const }, take: 1 },
      },
    });
    if (!existing) {
      return { type: 'error', code: 'case_not_found', message: 'Case not found.' } as const;
    }

    const activeRun = existing.pipelineRuns[0];
    if (!activeRun) {
      return { type: 'error', code: 'no_active_run', message: 'No active pipeline run found for this case.' } as const;
    }

    const runningStep = existing.pipelineSteps.find(s => s.status === 'running');
    if (!runningStep) {
      return { type: 'error', code: 'no_running_step', message: 'No step is currently running.' } as const;
    }

    const stepName = runningStep.name as typeof PIPELINE_STEP_ORDER[number];
    const stepMeta = STEP_SUMMARIES[stepName];
    const now = new Date();

    const updatedCase = await prisma.$transaction(async tx => {
      // Complete the currently-running step
      await tx.pipelineStep.update({
        where: { id: runningStep.id },
        data: {
          status:      'completed',
          completedAt: now,
          summary:     stepMeta.summary(activeRun.primarySourceIds.length, activeRun.contextSourceIds.length),
          confidence:  stepMeta.confidence,
        },
      });

      if (stepName === 'research') {
        // Start fact_check
        await tx.pipelineStep.updateMany({
          where: { contentCaseId: caseId, name: 'fact_check' },
          data:  { status: 'running', startedAt: now },
        });
        await tx.contentCase.update({
          where: { id: caseId },
          data:  { status: 'fact_check', updatedAt: now },
        });

      } else if (stepName === 'fact_check') {
        // Start content_creation
        await tx.pipelineStep.updateMany({
          where: { contentCaseId: caseId, name: 'content_creation' },
          data:  { status: 'running', startedAt: now },
        });
        await tx.contentCase.update({
          where: { id: caseId },
          data:  { status: 'generating', updatedAt: now },
        });

      } else if (stepName === 'content_creation') {
        // Final step: create mock outputs and complete the run.
        // Sources remain 'new' — they will become 'used' in Phase 5 when outputs are approved.
        const platforms = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt'] as const;
        await tx.contentOutput.createMany({
          data: platforms.map((platform, i) => ({
            contentCaseId: caseId,
            pipelineRunId: activeRun.id,
            platform,
            title: `${existing.title} — ${platform.replace('_', ' ')}`,
            body:  [
              `This is the AI-generated draft for ${platform} based on ${activeRun.primarySourceIds.length} new source${activeRun.primarySourceIds.length !== 1 ? 's' : ''}.`,
              activeRun.contextSourceIds.length > 0
                ? `${activeRun.contextSourceIds.length} previous source${activeRun.contextSourceIds.length !== 1 ? 's' : ''} were used as context to maintain consistency.`
                : null,
              'Edit, regenerate, or approve it below.',
            ].filter(Boolean).join('\n\n'),
            status:             'draft',
            version:            'v1.0.0',
            contentScore:       70 + i * 3,
            researchConfidence: 91,
            factCheckAccuracy:  96,
          })),
        });

        // Mark run as completed
        await tx.pipelineRun.update({
          where: { id: activeRun.id },
          data:  { status: 'completed', completedAt: now },
        });

        // Advance case to in_review
        await tx.contentCase.update({
          where: { id: caseId },
          data:  { status: 'in_review', updatedAt: now },
        });
      }

      return tx.contentCase.findUniqueOrThrow({
        where: { id: caseId },
        include: caseInclude,
      });
    });

    return { type: 'ok', case: serializeCase(updatedCase) } as const;
  },
};
