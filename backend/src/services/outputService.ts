import type { ContentOutput } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { UpdateOutputBodyInput, UpdateOutputStatusInput } from '../schemas/outputSchemas';
import { contentGenerationConfig } from '../lib/anthropic';
import { buildGeneratorInput } from './generatorInput';
import { generateContent } from './contentGeneratorService';
import { CONTENT_PLATFORMS, type ContentPlatform } from '../schemas/aiContractSchemas';
import { quotaConfig } from '../lib/quotaConfig';
import { checkAndIncrementUsage } from './usageService';

// ── Serializer ────────────────────────────────────────────────────────────────

export function serializeOutput(o: ContentOutput) {
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

// ── Service methods ───────────────────────────────────────────────────────────

export const outputService = {

  // PATCH /api/cases/:caseId/outputs/:outputId
  // Edit the body and optionally the title of a draft output.
  async updateBody(caseId: string, outputId: string, data: UpdateOutputBodyInput) {
    const existing = await prisma.contentOutput.findFirst({
      where: { id: outputId, contentCaseId: caseId },
    });
    if (!existing) return null;

    const updated = await prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        body: data.body,
        ...(data.title !== undefined ? { title: data.title } : {}),
      },
    });
    return serializeOutput(updated);
  },

  // PATCH /api/cases/:caseId/outputs/:outputId/status
  // Approve or reject an output.
  //
  // On APPROVE:
  //   1. Set output.status = approved, reviewedAt = now
  //   2. Upsert a LibraryItem (permanent, never overwritten by newer runs)
  //   3. If this is the FIRST approval for this run:
  //      → mark all primarySourceIds as used (status='used', usedInRunId, lastUsedAt)
  //
  // On REJECT:
  //   1. Set output.status = rejected, reviewedAt = now
  //   2. Remove the LibraryItem if it existed (e.g. reverting an approval)
  async updateStatus(caseId: string, outputId: string, data: UpdateOutputStatusInput) {
    const existing = await prisma.contentOutput.findFirst({
      where: { id: outputId, contentCaseId: caseId },
      include: { contentCase: { select: { title: true } } },
    });
    if (!existing) return null;

    const now = new Date();
    const { status } = data;

    const updated = await prisma.$transaction(async tx => {
      // 1. Update output status
      const output = await tx.contentOutput.update({
        where: { id: outputId },
        data: { status, reviewedAt: now },
      });

      if (status === 'approved') {
        // 2. Upsert LibraryItem — permanent record of this approved output
        await tx.libraryItem.upsert({
          where:  { outputId },
          create: {
            contentCaseId: caseId,
            outputId,
            pipelineRunId: existing.pipelineRunId,
            platform:      existing.platform,
            title:         existing.title,
            body:          existing.body,
            status:        'approved',
            version:       existing.version,
            date:          now,
          },
          update: {
            // Refresh body/title in case it was edited before approving
            body:    existing.body,
            title:   existing.title,
            status:  'approved',
            version: existing.version,
            date:    now,
          },
        });

        // 3. Mark primary sources as used — only on the FIRST approval for this run
        if (existing.pipelineRunId) {
          const run = await tx.pipelineRun.findUnique({
            where: { id: existing.pipelineRunId },
          });

          if (run && run.primarySourceIds.length > 0) {
            // Count approvals for this run EXCLUDING the current output
            const priorApprovals = await tx.contentOutput.count({
              where: {
                pipelineRunId: run.id,
                status:        'approved',
                id:            { not: outputId },
              },
            });

            if (priorApprovals === 0) {
              // First approval for this run → mark sources used
              await tx.contentSource.updateMany({
                where: { id: { in: run.primarySourceIds } },
                data:  {
                  status:      'used',
                  usedInRunId: run.id,
                  lastUsedAt:  now,
                },
              });
            }
          }
        }

      } else if (status === 'rejected') {
        // Remove the LibraryItem if it exists (reverting an approval)
        await tx.libraryItem.deleteMany({ where: { outputId } });
      }

      return output;
    });

    return serializeOutput(updated);
  },

  // POST /api/cases/:caseId/outputs/:outputId/regenerate
  // Full regenerate of one output (Phase 9 CP-2). Replaces body+breakdown+metadata
  // ON SUCCESS ONLY, bumps version, returns status to draft. Sources unaffected.
  // When CONTENT_GENERATION_ENABLED=true and the real generator falls back, the
  // OLD output is preserved and an error is thrown (route → 500).
  async regenerate(caseId: string, outputId: string) {
    const existing = await prisma.contentOutput.findFirst({
      where: { id: outputId, contentCaseId: caseId },
    });
    if (!existing) return null;

    // v2 generators cover the 5 content platforms only. Legacy image_prompt
    // outputs cannot be regenerated.
    if (!(CONTENT_PLATFORMS as readonly string[]).includes(existing.platform)) {
      throw new Error('This output type cannot be regenerated.');
    }
    if (!existing.pipelineRunId) {
      throw new Error('This output is not linked to a pipeline run and cannot be regenerated.');
    }

    // Text regeneration draws from the same PIPELINE_RUN bucket as a fresh run
    // (approved plan §8) — no separate regeneration-credit pool.
    if (quotaConfig.enforceQuotas) {
      const { userId } = await prisma.contentCase.findUniqueOrThrow({ where: { id: caseId }, select: { userId: true } });
      await checkAndIncrementUsage(userId, 'PIPELINE_RUN');
    }

    const [run, caseItem] = await Promise.all([
      prisma.pipelineRun.findUnique({ where: { id: existing.pipelineRunId } }),
      prisma.contentCase.findUnique({ where: { id: caseId } }),
    ]);
    if (!run || !caseItem) {
      throw new Error('Cannot regenerate — run or case is missing.');
    }
    const runSources = await prisma.contentSource.findMany({
      where: { id: { in: [...run.primarySourceIds, ...run.contextSourceIds] } },
    });

    // Build projection (throws if research/fact-check artifacts are missing).
    let out;
    try {
      const input = buildGeneratorInput(existing.platform as ContentPlatform, run, caseItem, runSources);
      out = await generateContent(input);   // never throws; may fall back
    } catch {
      throw new Error('Cannot regenerate — research/fact-check artifacts are missing. The previous output was kept.');
    }

    // Real-mode + the generator fell back → treat as failure, preserve old output.
    if (contentGenerationConfig.enabled && out.metadata.generatorVersion === 'mock-fallback') {
      throw new Error('Regeneration failed — the content generator did not return a valid result. The previous output was kept.');
    }

    const updated = await prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        status:             'draft',
        title:              out.title,
        body:               out.readyToPublish,
        breakdown:          out.breakdown as unknown as ReturnType<typeof JSON.parse>,
        metadata:           out.metadata as unknown as ReturnType<typeof JSON.parse>,
        contentScore:       out.metadata.contentScore ?? null,
        researchConfidence: out.metadata.researchConfidence ?? null,
        factCheckAccuracy:  out.metadata.factCheckAccuracy ?? null,
        version:            bumpVersion(existing.version),
        reviewedAt:         null,
      },
    });
    return serializeOutput(updated);
  },
};

function bumpVersion(version: string): string {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return version;
  return `v${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
}
