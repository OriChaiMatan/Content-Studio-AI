import type { ContentOutput } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { UpdateOutputBodyInput, UpdateOutputStatusInput } from '../schemas/outputSchemas';

// ── Serializer ────────────────────────────────────────────────────────────────

export function serializeOutput(o: ContentOutput) {
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
  // Reset output to draft with bumped version. Sources are not affected.
  async regenerate(caseId: string, outputId: string) {
    const existing = await prisma.contentOutput.findFirst({
      where: { id: outputId, contentCaseId: caseId },
    });
    if (!existing) return null;

    const updated = await prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        status:      'draft',
        body:        existing.body + '\n\n[Regenerated — AI would replace this content in production]',
        version:     bumpVersion(existing.version),
        reviewedAt:  null,
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
