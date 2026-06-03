// Pipeline endpoints use no required request body (caseId comes from the URL).
// This file reserves space for future fields (e.g. manual source selection).

export const PIPELINE_STEP_ORDER = ['research', 'fact_check', 'content_creation'] as const;
export type PipelineStepName = typeof PIPELINE_STEP_ORDER[number];

export const STEP_SUMMARIES: Record<PipelineStepName, { summary: (primaryCount: number, contextCount: number) => string; confidence: number }> = {
  research: {
    summary: (p, c) =>
      `Analyzed ${p} new source${p !== 1 ? 's' : ''} as primary material${c > 0 ? ` and ${c} previous source${c !== 1 ? 's' : ''} as context` : ''}. Key themes extracted and cross-referenced.`,
    confidence: 91,
  },
  fact_check: {
    summary: () =>
      'Cross-referenced all claims against available sources. Key statistics verified. Minor discrepancies flagged.',
    confidence: 96,
  },
  content_creation: {
    summary: () =>
      'Generated 6 platform-specific drafts ready for review.',
    confidence: 88,
  },
};
