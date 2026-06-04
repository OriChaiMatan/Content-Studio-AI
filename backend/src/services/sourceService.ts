import type { ContentSource, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { AddSourceInput, UpdateSourceInput } from '../schemas/sourceSchemas';
import { generateSourceIntelligence } from './sourceIntelligenceService';

// ── Serializer ────────────────────────────────────────────────────────────────
// Strips server-only fields (filePath, fileSize, mimeType) but includes
// lifecycle fields and source intelligence.

function serializeSource(s: ContentSource) {
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
    createdAt:           s.createdAt.toISOString(),
    updatedAt:           s.updatedAt ? s.updatedAt.toISOString() : null,
  };
}

// ── Service methods ───────────────────────────────────────────────────────────

export const sourceService = {

  // POST /api/cases/:id/sources
  async addSource(caseId: string, data: AddSourceInput) {
    return prisma.$transaction(async tx => {
      // Verify the case exists before creating the source.
      const caseExists = await tx.contentCase.findUnique({
        where: { id: caseId },
        select: { id: true },
      });
      if (!caseExists) return null;

      const resolvedLabel = data.label || data.type;
      // Generate deterministic source intelligence on creation
      const intelligence = generateSourceIntelligence(data.type, resolvedLabel, data.content);

      const source = await tx.contentSource.create({
        data: {
          contentCaseId:       caseId,
          type:                data.type,
          label:               resolvedLabel,
          content:             data.content,
          sourceIntelligence:  intelligence as ReturnType<typeof JSON.parse>,
        },
      });

      // Bump case updatedAt so the list sort order reflects the change.
      await tx.contentCase.update({
        where: { id: caseId },
        data:  { updatedAt: new Date() },
      });

      return serializeSource(source);
    });
  },

  // PATCH /api/cases/:id/sources/:sourceId
  async updateSource(caseId: string, sourceId: string, data: UpdateSourceInput) {
    return prisma.$transaction(async tx => {
      // Verify the source exists and belongs to this case.
      const existing = await tx.contentSource.findFirst({
        where: { id: sourceId, contentCaseId: caseId },
      });
      if (!existing) return null;

      const patch: Prisma.ContentSourceUpdateInput = {};
      if (data.label !== undefined) patch.label = data.label;
      if (data.content !== undefined) {
        patch.content   = data.content;
        patch.updatedAt = new Date();
        // Regenerate intelligence when content changes
        const newLabel = data.label !== undefined ? data.label : existing.label;
        patch.sourceIntelligence = generateSourceIntelligence(
          existing.type, newLabel, data.content
        ) as ReturnType<typeof JSON.parse>;
      } else if (data.label !== undefined) {
        // Label change only: regenerate intelligence with new label
        patch.sourceIntelligence = generateSourceIntelligence(
          existing.type, data.label, existing.content
        ) as ReturnType<typeof JSON.parse>;
      }

      const updated = await tx.contentSource.update({
        where: { id: sourceId },
        data:  patch,
      });

      await tx.contentCase.update({
        where: { id: caseId },
        data:  { updatedAt: new Date() },
      });

      return serializeSource(updated);
    });
  },

  // DELETE /api/cases/:id/sources/:sourceId
  async deleteSource(caseId: string, sourceId: string) {
    return prisma.$transaction(async tx => {
      // Verify ownership before deleting.
      const existing = await tx.contentSource.findFirst({
        where: { id: sourceId, contentCaseId: caseId },
      });
      if (!existing) return false;

      await tx.contentSource.delete({ where: { id: sourceId } });

      await tx.contentCase.update({
        where: { id: caseId },
        data:  { updatedAt: new Date() },
      });

      return true;
    });
  },
};
