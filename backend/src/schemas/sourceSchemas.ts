import { z } from 'zod';

export const addSourceSchema = z.object({
  type: z.enum(['text', 'url', 'pdf']),
  label: z.string().default(''),
  // content is required for all types:
  //   text → the note body
  //   url  → the URL string
  //   pdf  → the filename reference (real upload comes in a future phase)
  content: z.string().min(1, 'Source content is required'),
});

// Only label and content can be patched; type is immutable after creation.
export const updateSourceSchema = z.object({
  label:   z.string().optional(),
  content: z.string().min(1, 'Content cannot be empty').optional(),
}).refine(data => data.label !== undefined || data.content !== undefined, {
  message: 'At least one of label or content must be provided',
});

export type AddSourceInput    = z.infer<typeof addSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
