// Pipeline step names and order.
// STEP_SUMMARIES has been removed — summaries are now generated dynamically
// from the AI contract data (ResearchContext, FactCheckReport, ContentPackage)
// in pipelineService.advanceRun.

export const PIPELINE_STEP_ORDER = ['research', 'fact_check', 'content_creation'] as const;
export type PipelineStepName = typeof PIPELINE_STEP_ORDER[number];
