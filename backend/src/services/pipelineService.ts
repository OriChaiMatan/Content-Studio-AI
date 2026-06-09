import { prisma } from '../lib/prisma';
import { serializeCase } from './caseService';
import { PIPELINE_STEP_ORDER } from '../schemas/pipelineSchemas';

// Maps ContentTarget values (wizard) → content platform (Phase 9 v2).
// 'images' is RETIRED as a standalone output: image prompts are embedded inside
// LinkedIn/Facebook/Instagram. 'images' maps to undefined → no output (no-op).
const CONTENT_TARGET_TO_PLATFORM: Record<string, ContentPlatform | undefined> = {
  linkedin:   'linkedin',
  facebook:   'facebook',
  instagram:  'instagram',
  newsletter: 'newsletter',
  podcast:    'podcast',
  images:     undefined,
};
const ALL_CONTENT_PLATFORMS: ContentPlatform[] = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast'];
import {
  ResearchContextSchema,
  FactCheckReportSchema,
  type ResearchContext,
  type FactCheckReport,
  type GeneratedOutput,
  type ContentPlatform,
} from '../schemas/aiContractSchemas';
import {
  generateFactCheckReport,
} from './mockAiService';
import { contentGeneratorService } from './contentGeneratorService';
import { researchSynthesisService } from './researchSynthesisService';

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

  async startRun(caseId: string, outputLanguage?: string) {
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

    // Output language is chosen per run (Phase 8.6). Validate to en|he;
    // default to the case language for backward compatibility, else English.
    const resolvedLanguage =
      outputLanguage === 'en' || outputLanguage === 'he'
        ? outputLanguage
        : (existing.language === 'he' ? 'he' : 'en');

    const updatedCase = await prisma.$transaction(async tx => {
      await tx.pipelineRun.create({
        data: {
          contentCaseId:   caseId,
          triggeredBy:     'manual',
          status:          'running',
          outputLanguage:  resolvedLanguage,
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
      | { ok: true;  outputs: GeneratedOutput[] }
      | { ok: false; errorMessage: string };

    let contractResult: ContractResult;

    // Which platforms to generate (Phase 9 v2). Empty targets = all 5 content
    // platforms. 'images' maps to nothing (image prompts are embedded).
    const selectedPlatforms: ContentPlatform[] =
      existing.contentTargets.length > 0
        ? existing.contentTargets
            .map(t => CONTENT_TARGET_TO_PLATFORM[t])
            .filter((p): p is ContentPlatform => !!p)
        : ALL_CONTENT_PLATFORMS;

    try {
      if (stepName === 'research') {
        // Phase 10A: real Claude cross-source synthesis (flag-gated), else v1 mock.
        // synthesize() never throws and always returns a v1-valid v2 superset.
        const ctx = await researchSynthesisService.synthesize({
          run: activeRun, caseItem: existing, primarySources, contextSources,
        });
        // Phase 10D.0 — QA strict mode: a degraded research stage (mock-fallback)
        // must NOT silently continue to content generation. Fail the run hard so
        // validation never mistakes a mock thesis for a real one. Production
        // (flag unset) continues safely and surfaces the degradation instead.
        const ctxMeta = (ctx as { meta?: { degraded?: boolean; generatorVersion?: string } }).meta;
        if (process.env.PIPELINE_FAIL_ON_DEGRADED === 'true' && ctxMeta?.degraded) {
          throw new Error(
            `Research degraded (${ctxMeta.generatorVersion}): synthesis fell back to mock and the thesis competition did not run. ` +
            `Aborting under PIPELINE_FAIL_ON_DEGRADED=true (QA strict mode).`,
          );
        }
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
        // content_creation (Phase 9 v2): needs both researchContext and factCheckReport.
        const rcParsed  = ResearchContextSchema.safeParse(activeRun.researchContext);
        const fcrParsed = FactCheckReportSchema.safeParse(activeRun.factCheckReport);
        if (!rcParsed.success)  throw new Error(`Research context missing — cannot generate content.`);
        if (!fcrParsed.success) throw new Error(`Fact check report missing — cannot generate content.`);

        // Generate selected platforms only, from the projection (no raw articles).
        // Real Claude generation when CONTENT_GENERATION_ENABLED=true, else the
        // permanent v2 mock. Each generator is isolated and never throws.
        const runSources = [...primarySources, ...contextSources];
        const outputs = await contentGeneratorService.generateAll(
          selectedPlatforms, activeRun, existing, runSources,
        );
        contractResult = { ok: true, outputs };
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
      // Phase 10D.0 — a contract failure means the RUN failed; don't leave it
      // 'running' (so QA strict mode produces an unambiguous failed run).
      await prisma.pipelineRun.update({ where: { id: activeRun.id }, data: { status: 'failed', completedAt: now, errorMessage } });
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
        // Phase 10D.0 — step-level visibility: a degraded research stage must read
        // DEGRADED (not a normal "Analyzed N sources" success), with low confidence
        // and an explicit note that the thesis competition did not run.
        const rcMeta = (rc as unknown as { meta?: { degraded?: boolean; generatorVersion?: string }; synthesis?: { thesisCompetition?: { candidates?: unknown[] } } });
        const candCount = Array.isArray(rcMeta.synthesis?.thesisCompetition?.candidates) ? rcMeta.synthesis!.thesisCompetition!.candidates!.length : 0;
        const sourcesLine =
          `${primarySources.length} primary source${primarySources.length !== 1 ? 's' : ''}` +
          (contextSources.length > 0 ? ` + ${contextSources.length} context source${contextSources.length !== 1 ? 's' : ''}` : '');
        if (rcMeta.meta?.degraded) {
          summary = `⚠ DEGRADED — research synthesis fell back to mock (${rcMeta.meta.generatorVersion}). Thesis competition did NOT run; downstream content is built on a mock thesis, not real synthesis. (${sourcesLine})`;
          confidence = Math.min(rc.confidenceScore, 25);
        } else if (rcMeta.meta?.generatorVersion === 'mock-research') {
          summary = `Research used the deterministic mock (real synthesis disabled). ${rc.mainTopics.length} topics, ${rc.importantClaims.length} claims. (${sourcesLine})`;
          confidence = rc.confidenceScore;
        } else {
          summary = `Analyzed ${sourcesLine}. ${rc.mainTopics.length} main topics, ${rc.importantClaims.length} key claims. ✓ Thesis competition ran — ${candCount} candidate${candCount !== 1 ? 's' : ''} evaluated.`;
          confidence = rc.confidenceScore;
        }
        pRunUpdate.researchContext = rc as unknown as Record<string, unknown>;

      } else if ('factCheckReport' in contractResult && contractResult.factCheckReport) {
        const fcr = contractResult.factCheckReport;
        summary =
          `Checked ${fcr.claimsChecked} claim${fcr.claimsChecked !== 1 ? 's' : ''}. ` +
          `${fcr.verifiedClaims.length} verified, ${fcr.uncertainClaims.length} uncertain, ${fcr.conflictingClaims.length} conflicting.` +
          (fcr.warnings.length > 0 ? ` ${fcr.warnings.length} warning${fcr.warnings.length !== 1 ? 's' : ''} issued.` : '');
        confidence = fcr.overallConfidenceScore;
        pRunUpdate.factCheckReport = fcr as unknown as Record<string, unknown>;

      } else if ('outputs' in contractResult && contractResult.outputs) {
        const outputs = contractResult.outputs;
        summary = outputs.length > 0
          ? `Generated ${outputs.length} content output${outputs.length !== 1 ? 's' : ''}: ${outputs.map(o => o.platform).join(', ')}.`
          : `No content platforms selected — nothing to generate.`;
        confidence = 88;
        pRunUpdate.contentPackage = { version: 2, outputs } as unknown as Record<string, unknown>;

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
        // Persist v2 GeneratedOutput[] → ContentOutput rows.
        // body = readyToPublish (editable); breakdown + metadata are read-only JSON.
        const outputs = (contractResult as { ok: true; outputs: GeneratedOutput[] }).outputs;

        if (outputs.length > 0) {
          await tx.contentOutput.createMany({
            data: outputs.map(o => ({
              contentCaseId:      caseId,
              pipelineRunId:      activeRun.id,
              platform:           o.platform,
              title:              o.title,
              body:               o.readyToPublish,
              status:             'draft',
              version:            'v2.0.0',
              contentScore:       o.metadata.contentScore ?? null,
              researchConfidence: o.metadata.researchConfidence ?? null,
              factCheckAccuracy:  o.metadata.factCheckAccuracy ?? null,
              breakdown:          o.breakdown as unknown as ReturnType<typeof JSON.parse>,
              metadata:           o.metadata as unknown as ReturnType<typeof JSON.parse>,
            })),
          });
        }

        // Complete run (even when 0 outputs — e.g. only 'images' was selected).
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
