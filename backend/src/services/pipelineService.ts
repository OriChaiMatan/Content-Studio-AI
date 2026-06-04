import { prisma } from '../lib/prisma';
import { serializeCase } from './caseService';
import { PIPELINE_STEP_ORDER } from '../schemas/pipelineSchemas';

// Maps ContentTarget values (wizard) → Platform enum values (DB / ContentOutput)
const TARGET_TO_PLATFORM: Record<string, string> = {
  linkedin:    'linkedin',
  facebook:    'facebook',
  instagram:   'instagram',
  newsletter:  'newsletter',
  podcast:     'podcast',
  images:      'image_prompt',
};
const ALL_PLATFORMS = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt'];
import {
  ResearchContextSchema,
  FactCheckReportSchema,
  ContentPackageSchema,
  type ResearchContext,
  type FactCheckReport,
  type ContentPackage,
} from '../schemas/aiContractSchemas';
import {
  generateResearchContext,
  generateFactCheckReport,
  generateContentPackage,
} from './mockAiService';
import { packageToOutputs } from './contentPackageMapper';

// ── Source selection ───────────────────────────────────────────────────────────

function partitionSources(sources: { id: string; status: string }[]) {
  return {
    primary: sources.filter(s => s.status === 'new').map(s => s.id),
    context: sources.filter(s => s.status === 'used').map(s => s.id),
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

  async startRun(caseId: string) {
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
    if (existing.pipelineRuns.length > 0) {
      return { type: 'error', code: 'already_running', message: 'A pipeline run is already in progress for this case.' } as const;
    }

    const { primary: primarySourceIds, context: contextSourceIds } = partitionSources(existing.sources);
    if (primarySourceIds.length === 0) {
      return {
        type: 'error',
        code: 'no_new_sources',
        message: 'No new sources are available for this case. Add new sources or reuse existing ones.',
      } as const;
    }

    const updatedCase = await prisma.$transaction(async tx => {
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
      await tx.pipelineStep.updateMany({
        where: { contentCaseId: caseId },
        data:  { status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
      });
      await tx.pipelineStep.updateMany({
        where: { contentCaseId: caseId, name: 'research' },
        data:  { status: 'running', startedAt: new Date() },
      });
      await tx.contentCase.update({
        where: { id: caseId },
        data:  { status: 'research', updatedAt: new Date() },
      });
      return tx.contentCase.findUniqueOrThrow({ where: { id: caseId }, include: caseInclude });
    });

    return { type: 'ok', case: serializeCase(updatedCase) } as const;
  },

  // ── Advance the current run one step ─────────────────────────────────────────
  //
  // Contract-driven pipeline:
  //   research         → generates + persists ResearchContext
  //   fact_check       → generates + persists FactCheckReport (uses researchContext)
  //   content_creation → generates + persists ContentPackage → creates 6 ContentOutputs
  //
  // If contract generation or Zod validation fails:
  //   → step is marked as 'error' with the error message stored in summary
  //   → no partial outputs are created
  //   → backend does not crash
  //
  async advanceRun(caseId: string) {
    // ── Load case with sources and active run ──────────────────────────────────
    const existing = await prisma.contentCase.findUnique({
      where: { id: caseId },
      include: {
        sources:       true,
        pipelineSteps: true,
        pipelineRuns:  {
          where:   { status: 'running' },
          orderBy: { startedAt: 'desc' as const },
          take:    1,
        },
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
    const now = new Date();

    // ── Partition sources for this run ────────────────────────────────────────
    const primarySources = existing.sources.filter(s => activeRun.primarySourceIds.includes(s.id));
    const contextSources = existing.sources.filter(s => activeRun.contextSourceIds.includes(s.id));

    // ── Generate + validate contract data OUTSIDE the transaction ─────────────
    // Errors here mark the step as 'error' and abort — no partial writes.

    type ContractResult =
      | { ok: true;  researchContext: ResearchContext }
      | { ok: true;  factCheckReport: FactCheckReport }
      | { ok: true;  contentPackage:  ContentPackage }
      | { ok: false; errorMessage: string };

    let contractResult: ContractResult;

    try {
      if (stepName === 'research') {
        const ctx = generateResearchContext(activeRun, existing, primarySources, contextSources);
        contractResult = { ok: true, researchContext: ctx };

      } else if (stepName === 'fact_check') {
        // Re-validate the previously persisted researchContext from DB
        const rcParsed = ResearchContextSchema.safeParse(activeRun.researchContext);
        if (!rcParsed.success) {
          throw new Error(`Research context is missing or invalid: ${rcParsed.error.message}`);
        }
        const report = generateFactCheckReport(activeRun, rcParsed.data, primarySources, contextSources);
        contractResult = { ok: true, factCheckReport: report };

      } else {
        // content_creation: needs both researchContext and factCheckReport
        const rcParsed  = ResearchContextSchema.safeParse(activeRun.researchContext);
        const fcrParsed = FactCheckReportSchema.safeParse(activeRun.factCheckReport);
        if (!rcParsed.success)  throw new Error(`Research context missing — cannot generate content.`);
        if (!fcrParsed.success) throw new Error(`Fact check report missing — cannot generate content.`);
        const pkg = generateContentPackage(activeRun, existing, rcParsed.data, fcrParsed.data);
        contractResult = { ok: true, contentPackage: pkg };
      }

    } catch (err) {
      // Contract generation or Zod validation failed — mark step as error, no partial writes
      const errorMessage = err instanceof Error ? err.message : 'Unknown contract error';
      await prisma.pipelineStep.update({
        where: { id: runningStep.id },
        data:  {
          status:      'error',
          completedAt: now,
          summary:     `Pipeline step failed: ${errorMessage}`,
          confidence:  0,
        },
      });
      return {
        type:    'error',
        code:    'contract_validation_failed',
        message: `Contract validation failed at ${stepName}: ${errorMessage}`,
      } as const;
    }

    // ── Persist contract data + advance step — inside a single transaction ────

    const updatedCase = await prisma.$transaction(async tx => {

      // Determine step summary and confidence from contract output
      let summary: string;
      let confidence: number;
      const pRunUpdate: Record<string, unknown> = {};

      if ('researchContext' in contractResult && contractResult.researchContext) {
        const rc = contractResult.researchContext;
        summary =
          `Analyzed ${primarySources.length} primary source${primarySources.length !== 1 ? 's' : ''}` +
          (contextSources.length > 0 ? ` + ${contextSources.length} context source${contextSources.length !== 1 ? 's' : ''}` : '') +
          `. ${rc.mainTopics.length} main topics identified. ${rc.importantClaims.length} key claims extracted.`;
        confidence = rc.confidenceScore;
        pRunUpdate.researchContext = rc as unknown as Record<string, unknown>;

      } else if ('factCheckReport' in contractResult && contractResult.factCheckReport) {
        const fcr = contractResult.factCheckReport;
        summary =
          `Checked ${fcr.claimsChecked} claim${fcr.claimsChecked !== 1 ? 's' : ''}. ` +
          `${fcr.verifiedClaims.length} verified, ${fcr.uncertainClaims.length} uncertain, ${fcr.conflictingClaims.length} conflicting.` +
          (fcr.warnings.length > 0 ? ` ${fcr.warnings.length} warning${fcr.warnings.length !== 1 ? 's' : ''} issued.` : '');
        confidence = fcr.overallConfidenceScore;
        pRunUpdate.factCheckReport = fcr as unknown as Record<string, unknown>;

      } else if ('contentPackage' in contractResult && contractResult.contentPackage) {
        const pkg = contractResult.contentPackage;
        const hCount = pkg.linkedin.hashtags.length;
        summary =
          `Generated structured content package: LinkedIn (${hCount} hashtags), Facebook, Instagram (${pkg.instagram.strongLine.split(' ').length}-word strong line), Newsletter, Podcast script (${pkg.podcast.segments.length} segments), and 2 image prompts.`;
        confidence = 88;
        pRunUpdate.contentPackage = pkg as unknown as Record<string, unknown>;

      } else {
        summary = 'Step completed.';
        confidence = 80;
      }

      // Persist contract JSON to the run
      if (Object.keys(pRunUpdate).length > 0) {
        await tx.pipelineRun.update({
          where: { id: activeRun.id },
          data:  pRunUpdate,
        });
      }

      // Complete the running step
      await tx.pipelineStep.update({
        where: { id: runningStep.id },
        data:  { status: 'completed', completedAt: now, summary, confidence },
      });

      // Advance to next step
      if (stepName === 'research') {
        await tx.pipelineStep.updateMany({
          where: { contentCaseId: caseId, name: 'fact_check' },
          data:  { status: 'running', startedAt: now },
        });
        await tx.contentCase.update({
          where: { id: caseId },
          data:  { status: 'fact_check', updatedAt: now },
        });

      } else if (stepName === 'fact_check') {
        await tx.pipelineStep.updateMany({
          where: { contentCaseId: caseId, name: 'content_creation' },
          data:  { status: 'running', startedAt: now },
        });
        await tx.contentCase.update({
          where: { id: caseId },
          data:  { status: 'generating', updatedAt: now },
        });

      } else if (stepName === 'content_creation') {
        // Transform ContentPackage → 6 ContentOutput records
        const pkg = (contractResult as { ok: true; contentPackage: ContentPackage }).contentPackage;
        const fcr = FactCheckReportSchema.safeParse(activeRun.factCheckReport);
        const rc  = ResearchContextSchema.safeParse(activeRun.researchContext);

        const researchConfidence = rc.success  ? rc.data.confidenceScore               : 88;
        const factCheckAccuracy  = fcr.success ? fcr.data.overallConfidenceScore        : 91;

        // Determine which platforms to generate based on contentTargets.
        // Empty array = legacy backward compat → generate all 6.
        const selectedPlatforms =
          existing.contentTargets.length > 0
            ? existing.contentTargets
                .map(t => TARGET_TO_PLATFORM[t])
                .filter((p): p is string => !!p)
            : ALL_PLATFORMS;

        const outputBodies = packageToOutputs(pkg, existing);
        const platforms = (Object.keys(outputBodies) as Array<keyof typeof outputBodies>)
          .filter(k => selectedPlatforms.includes(k));

        await tx.contentOutput.createMany({
          data: platforms.map(platform => ({
            contentCaseId:      caseId,
            pipelineRunId:      activeRun.id,
            platform,
            title:              outputBodies[platform].title,
            body:               outputBodies[platform].body,
            status:             'draft',
            version:            'v1.0.0',
            contentScore:       outputBodies[platform].contentScore,
            researchConfidence,
            factCheckAccuracy,
          })),
        });

        // Complete run
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

      return tx.contentCase.findUniqueOrThrow({ where: { id: caseId }, include: caseInclude });
    });

    return { type: 'ok', case: serializeCase(updatedCase) } as const;
  },
};
