import type { ContentSource, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { AddSourceInput, UpdateSourceInput } from '../schemas/sourceSchemas';

// ── Serializer ────────────────────────────────────────────────────────────────
// Strips server-only fields (filePath, fileSize, mimeType) from the response.

function serializeSource(s: ContentSource) {
  return {
    id:            s.id,
    contentCaseId: s.contentCaseId,
    type:          s.type,
    label:         s.label,
    content:       s.content,
    createdAt:     s.createdAt.toISOString(),
    updatedAt:     s.updatedAt ? s.updatedAt.toISOString() : null,
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

      const source = await tx.contentSource.create({
        data: {
          contentCaseId: caseId,
          type:          data.type,
          label:         data.label || data.type, // default label to type name if blank
          content:       data.content,
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
      if (data.label   !== undefined) patch.label   = data.label;
      if (data.content !== undefined) {
        patch.content   = data.content;
        patch.updatedAt = new Date(); // marks "edited"
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
