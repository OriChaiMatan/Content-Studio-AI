import type { ContentSource, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { AddSourceInput, UpdateSourceInput } from '../schemas/sourceSchemas';
import { analyze } from './sourceAnalysisService';
import { extract as extractUrl } from './urlExtractionService';
import { extractPdf } from './pdfExtractionService';
import type { SourceIntelligence } from '../schemas/aiContractSchemas';

// ── Serializer ────────────────────────────────────────────────────────────────
// Strips server-only fields (filePath, fileSize, mimeType) but includes
// lifecycle fields, source intelligence, and URL-extraction metadata.

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

// Persisted extraction metadata for a source.
interface ExtractionFields {
  extractedTitle:   string | null;
  extractedText:    string | null;
  extractionStatus: string;   // "success" | "failed" | "skipped"
  extractionError:  string | null;
  extractedAt:      Date | null;
}

// Optional file metadata (pdf sources only).
interface FileMeta {
  fileSize?: number | null;
  mimeType?: string | null;
}

// Extract (url + pdf) + analyze. url → fetch & extract readable text; pdf →
// decode base64 & extract text; both analyze the extracted text on success, or
// fall back to the URL/filename + label on failure. text → no extraction.
// Nothing here throws — adding a source never fails because extraction failed.
async function extractAndAnalyze(
  type: string,
  label: string,
  content: string,
  fileData?: string,
): Promise<{ intelligence: SourceIntelligence; fields: ExtractionFields; fileMeta: FileMeta }> {
  if (type === 'url') {
    const result = await extractUrl(content);

    if (result.status === 'success' && result.text) {
      // Analyze the real article text rather than the bare URL string.
      const intelligence = await analyze({ type: 'url', label, content: result.text });
      return {
        intelligence,
        fields: {
          extractedTitle:   result.title ?? null,
          extractedText:    result.text,
          extractionStatus: 'success',
          extractionError:  null,
          extractedAt:      new Date(),
        },
        fileMeta: {},
      };
    }

    // Extraction failed (or content too short) → URL + label fallback analysis.
    const intelligence = await analyze({ type: 'url', label, content });
    return {
      intelligence,
      fields: {
        extractedTitle:   null,
        extractedText:    null,
        extractionStatus: 'failed',
        extractionError:  result.error ?? 'We could not read this page.',
        extractedAt:      new Date(),
      },
      fileMeta: {},
    };
  }

  if (type === 'pdf') {
    // No file bytes (e.g. legacy filename-only reference) → skip extraction.
    if (!fileData) {
      const intelligence = await analyze({ type: 'pdf', label, content });
      return {
        intelligence,
        fields: { extractedTitle: null, extractedText: null, extractionStatus: 'skipped', extractionError: null, extractedAt: null },
        fileMeta: {},
      };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileData, 'base64');
    } catch {
      buffer = Buffer.alloc(0);
    }
    const result = await extractPdf(buffer, content);
    const mimeType = 'application/pdf';

    if (result.status === 'success' && result.text) {
      const intelligence = await analyze({ type: 'pdf', label, content: result.text });
      return {
        intelligence,
        fields: {
          extractedTitle:   result.title ?? null,
          extractedText:    result.text,
          extractionStatus: 'success',
          extractionError:  null,
          extractedAt:      new Date(),
        },
        fileMeta: { fileSize: buffer.length || null, mimeType },
      };
    }

    // Extraction failed → filename + label fallback analysis.
    const intelligence = await analyze({ type: 'pdf', label, content });
    return {
      intelligence,
      fields: {
        extractedTitle:   null,
        extractedText:    null,
        extractionStatus: 'failed',
        extractionError:  result.error ?? 'We could not read this PDF.',
        extractedAt:      new Date(),
      },
      fileMeta: { fileSize: buffer.length || null, mimeType },
    };
  }

  // text — extraction is not applicable.
  const intelligence = await analyze({ type, label, content });
  return {
    intelligence,
    fields: { extractedTitle: null, extractedText: null, extractionStatus: 'skipped', extractionError: null, extractedAt: null },
    fileMeta: {},
  };
}

// ── Phase 11B — bounded-concurrency pool ──────────────────────────────────────
// Runs `fn` over `items` with at most `limit` in flight at once, preserving input
// order and ISOLATING failures (one rejected item never aborts the others).
// Used to analyze a batch of sources concurrently while respecting the Anthropic
// rate limit via the concurrency cap.
const SOURCE_BATCH_CONCURRENCY = Math.max(1, parseInt(process.env.SOURCE_ANALYSIS_BATCH_CONCURRENCY ?? '5', 10));

async function runPool<T, R>(
  items: T[], limit: number, fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { status: 'fulfilled', value: await fn(items[i], i) }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export type BatchSourceResult =
  | { index: number; ok: true; source: NonNullable<Awaited<ReturnType<typeof sourceService.addSource>>> }
  | { index: number; ok: false; error: string };

// ── Service methods ───────────────────────────────────────────────────────────

export const sourceService = {

  // POST /api/cases/:id/sources
  async addSource(caseId: string, data: AddSourceInput) {
    // Verify the case exists before doing extraction/analysis work.
    const caseExists = await prisma.contentCase.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!caseExists) return null;

    const resolvedLabel = data.label || data.type;
    // Extraction + analysis run OUTSIDE the transaction so network/CPU work (URL
    // fetch, PDF parse, Claude) never holds a DB lock open. All are crash-safe.
    const { intelligence, fields, fileMeta } = await extractAndAnalyze(
      data.type, resolvedLabel, data.content, data.fileData,
    );

    return prisma.$transaction(async tx => {
      // Re-verify inside the transaction (the case could have been deleted
      // during analysis); the FK would reject the create otherwise.
      const stillExists = await tx.contentCase.findUnique({
        where: { id: caseId },
        select: { id: true },
      });
      if (!stillExists) return null;

      const source = await tx.contentSource.create({
        data: {
          contentCaseId:       caseId,
          type:                data.type,
          label:               resolvedLabel,
          content:             data.content,   // original URL / filename — never the extracted body
          sourceIntelligence:  intelligence as ReturnType<typeof JSON.parse>,
          extractedTitle:      fields.extractedTitle,
          extractedText:       fields.extractedText,
          extractionStatus:    fields.extractionStatus,
          extractionError:     fields.extractionError,
          extractedAt:         fields.extractedAt,
          fileSize:            fileMeta.fileSize ?? null,
          mimeType:            fileMeta.mimeType ?? null,
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

  // Phase 11B — POST /api/cases/:id/sources/batch
  // Add multiple sources whose analysis runs CONCURRENTLY (bounded by
  // SOURCE_BATCH_CONCURRENCY to respect the Anthropic rate limit). Each source is
  // processed by the EXACT same addSource() path — identical extraction, analysis,
  // Claude retries, transaction, and serialization — so per-source output and
  // behaviour are unchanged. Failures are isolated per source (one bad source does
  // not abort the rest). Returns null only when the case itself does not exist.
  async addSourcesBatch(caseId: string, inputs: AddSourceInput[]): Promise<BatchSourceResult[] | null> {
    const caseExists = await prisma.contentCase.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!caseExists) return null;

    const startedAt = Date.now();
    const settled = await runPool(inputs, SOURCE_BATCH_CONCURRENCY, inp => sourceService.addSource(caseId, inp));
    const results: BatchSourceResult[] = settled.map((r, index) =>
      r.status === 'fulfilled' && r.value
        ? { index, ok: true, source: r.value }
        : { index, ok: false, error: r.status === 'rejected'
            ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
            : 'Case not found during analysis' });

    const ok = results.filter(r => r.ok).length;
    console.log(`[sources:batch] case=${caseId} n=${inputs.length} concurrency=${SOURCE_BATCH_CONCURRENCY} ok=${ok} failed=${inputs.length - ok} elapsedMs=${Date.now() - startedAt}`);
    return results;
  },

  // PATCH /api/cases/:id/sources/:sourceId
  async updateSource(caseId: string, sourceId: string, data: UpdateSourceInput) {
    // Verify the source exists and belongs to this case before any work.
    const existing = await prisma.contentSource.findFirst({
      where: { id: sourceId, contentCaseId: caseId },
    });
    if (!existing) return null;

    const patch: Prisma.ContentSourceUpdateInput = {};
    if (data.label !== undefined) patch.label = data.label;

    if (data.manualText !== undefined) {
      // Manual text replacement (Phase 8.5): the user pasted readable text for a
      // url/pdf source whose auto-extraction failed. Store it as the extracted
      // text, flip extraction to success, and re-analyze on it. The original
      // content (URL / filename) is preserved so it stays visible.
      patch.updatedAt        = new Date();
      patch.extractedText    = data.manualText;
      patch.extractionStatus = 'success';
      patch.extractionError  = null;
      patch.extractedAt      = new Date();
      const newLabel = data.label !== undefined ? data.label : existing.label;
      const intelligence = await analyze({
        type: existing.type,
        label: newLabel,
        content: data.manualText,
      });
      patch.sourceIntelligence = intelligence as ReturnType<typeof JSON.parse>;
    } else if (data.content !== undefined) {
      // Content changed → re-extract (url) and re-analyze. OUTSIDE the txn.
      patch.content   = data.content;
      patch.updatedAt = new Date();
      const newLabel = data.label !== undefined ? data.label : existing.label;
      const { intelligence, fields } = await extractAndAnalyze(
        existing.type, newLabel, data.content,
      );
      patch.sourceIntelligence = intelligence as ReturnType<typeof JSON.parse>;
      patch.extractedTitle     = fields.extractedTitle;
      patch.extractedText      = fields.extractedText;
      patch.extractionStatus   = fields.extractionStatus;
      patch.extractionError    = fields.extractionError;
      patch.extractedAt        = fields.extractedAt;
    } else if (data.label !== undefined) {
      // Label-only change → re-analyze WITHOUT re-fetching the URL. Reuse the
      // stored extracted text when extraction previously succeeded; otherwise
      // fall back to the original content (URL string / text body).
      const analysisContent =
        existing.type === 'url' && existing.extractionStatus === 'success' && existing.extractedText
          ? existing.extractedText
          : existing.content;
      const intelligence = await analyze({
        type: existing.type,
        label: data.label,
        content: analysisContent,
      });
      patch.sourceIntelligence = intelligence as ReturnType<typeof JSON.parse>;
      // Extraction fields are left untouched — the URL did not change.
    }

    return prisma.$transaction(async tx => {
      // Re-verify inside the transaction (the source could have been deleted
      // during analysis).
      const stillExists = await tx.contentSource.findFirst({
        where: { id: sourceId, contentCaseId: caseId },
        select: { id: true },
      });
      if (!stillExists) return null;

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
