import type { Response } from 'express';
import type { PlanStatus, UsageMetric } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Typed errors thrown by usageService gates. Each carries `status` + `code` so
// route handlers can build a consistent JSON body — `error` stays a human
// string (every existing frontend catch block already surfaces it verbatim),
// `code`/extra fields are additive for upgrade-aware UI to branch on later.
// ─────────────────────────────────────────────────────────────────────────────

// Singular label per metric — naive "lowercase + replace underscores" pluralization
// breaks for SOURCE_ADDED ("source addeds"), so each metric spells out its own
// natural-language noun instead of deriving one from the enum name.
const METRIC_LABEL: Record<UsageMetric, string> = {
  PIPELINE_RUN: 'pipeline run',
  SOURCE_ADDED: 'source',
  IMAGE_GENERATION: 'image generation',
};

export class QuotaExceededError extends Error {
  readonly status = 403;
  readonly code = 'quota_exceeded' as const;
  constructor(readonly metric: UsageMetric, readonly limit: number, readonly resetAt: Date) {
    const label = METRIC_LABEL[metric];
    super(`You've used all ${limit} ${label}${limit === 1 ? '' : 's'} for this cycle. Resets ${resetAt.toISOString()}.`);
    this.name = 'QuotaExceededError';
  }
}

export class CaseLimitError extends Error {
  readonly status = 403;
  readonly code = 'case_limit_reached' as const;
  constructor(readonly limit: number) {
    super(`You've reached your plan's limit of ${limit} active content case${limit === 1 ? '' : 's'}.`);
    this.name = 'CaseLimitError';
  }
}

export class PlanNotUsableError extends Error {
  readonly status = 403;
  readonly code = 'plan_not_usable' as const;
  constructor(readonly planStatus: PlanStatus) {
    super(
      planStatus === 'SUSPENDED'
        ? 'Your account is suspended. Contact support to reactivate.'
        : `Your account is not currently usable (status: ${planStatus}).`,
    );
    this.name = 'PlanNotUsableError';
  }
}

export class SchedulingNotAllowedError extends Error {
  readonly status = 400;
  readonly code = 'scheduling_not_allowed' as const;
  constructor() {
    super('Daily scheduling is available in LumAI Pro.');
    this.name = 'SchedulingNotAllowedError';
  }
}

export type QuotaError = QuotaExceededError | CaseLimitError | PlanNotUsableError | SchedulingNotAllowedError;

export function isQuotaError(err: unknown): err is QuotaError {
  return (
    err instanceof QuotaExceededError ||
    err instanceof CaseLimitError ||
    err instanceof PlanNotUsableError ||
    err instanceof SchedulingNotAllowedError
  );
}

// Shared response shape for every quota-gate rejection across all route
// handlers — `error` is always a human string (every existing frontend catch
// block already surfaces it verbatim with zero changes); `code` and the
// metric-specific fields are additive, for upgrade-aware UI built later.
export function sendQuotaError(res: Response, err: QuotaError): void {
  const body: Record<string, unknown> = { error: err.message, code: err.code };
  if (err instanceof QuotaExceededError) {
    body.metric = err.metric;
    body.resetAt = err.resetAt.toISOString();
    body.limit = err.limit;
  }
  if (err instanceof CaseLimitError) {
    body.limit = err.limit;
  }
  res.status(err.status).json(body);
}
