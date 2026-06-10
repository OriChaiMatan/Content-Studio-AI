import { z } from 'zod';

export const addSourceSchema = z.object({
  type: z.enum(['text', 'url', 'pdf']),
  label: z.string().default(''),
  // content is required for all types:
  //   text → the note body
  //   url  → the URL string
  //   pdf  → the original filename (the bytes arrive in fileData)
  content: z.string().min(1, 'Source content is required'),
  // Phase 8.5: base64-encoded PDF bytes (pdf sources only). Optional so url/text
  // are unaffected and a pdf without a file still saves (extraction skipped).
  fileData: z.string().optional(),
});

// label/content can be patched; type is immutable. Phase 8.5 adds manualText —
// pasted article/document text for a url or pdf source whose auto-extraction
// failed; analysis re-runs on it while the original URL/filename is preserved.
export const updateSourceSchema = z.object({
  label:      z.string().optional(),
  content:    z.string().min(1, 'Content cannot be empty').optional(),
  manualText: z.string().min(1, 'Pasted text cannot be empty').optional(),
}).refine(
  data => data.label !== undefined || data.content !== undefined || data.manualText !== undefined,
  { message: 'At least one of label, content, or manualText must be provided' },
);

// Phase 11B — batch ingestion: add several sources in one request so their
// analysis runs CONCURRENTLY (each source still validated by addSourceSchema).
export const addSourcesBatchSchema = z.object({
  sources: z.array(addSourceSchema).min(1, 'At least one source is required').max(25, 'At most 25 sources per batch'),
});

export type AddSourceInput    = z.infer<typeof addSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type AddSourcesBatchInput = z.infer<typeof addSourcesBatchSchema>;
