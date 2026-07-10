import { randomUUID } from 'node:crypto';
import type { Plan, PlanStatus, Prisma, PrismaClient, ScheduleFrequency, SystemRole, UsageMetric } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getPlanDefinition, getUsageLimit } from '../lib/planDefinitions';
import { QuotaExceededError, CaseLimitError, PlanNotUsableError, SchedulingNotAllowedError } from '../lib/quotaErrors';

// ─────────────────────────────────────────────────────────────────────────────
// Roles/Plans/Usage enforcement engine (Phase 2). All decision logic that does
// NOT need a DB round-trip is written as a small pure function (below) so it's
// unit-testable the same way the rest of this codebase tests services — see
// usageService.test.ts. The DB-touching orchestration wraps these.
//
// MASTER bypass is centralized here (canBypassLimits), not duplicated at each
// of the 5+ call sites that use this module.
// ─────────────────────────────────────────────────────────────────────────────

const USER_SCOPE = 'user';

// ── Pure decision logic (unit-tested directly) ────────────────────────────────

export function canBypassLimits(systemRole: SystemRole): boolean {
  return systemRole === 'MASTER';
}

// Every PlanStatus except SUSPENDED is usable today. PAST_DUE/TRIAL are
// reachable states reserved for when billing lands (see Phase 5 of the
// approved plan) — until then they behave as usable, same as ACTIVE/CANCELED.
export function isPlanUsable(planStatus: PlanStatus): boolean {
  return planStatus !== 'SUSPENDED';
}

export function isPeriodExpired(currentUsagePeriodEnd: Date, now: Date): boolean {
  return now.getTime() >= currentUsagePeriodEnd.getTime();
}

// Deliberate "snap to now" design (see approved plan §3): a new cycle always
// starts at `now`, never by advancing the old boundary forward in fixed
// increments. Avoids meaningless "catch-up" math for a long-inactive user.
export function computeNextPeriod(plan: Plan, now: Date): { start: Date; end: Date } {
  const cycleDays = getPlanDefinition(plan).limits.cycleDays;
  const end = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  return { start: now, end };
}

// A CANCELED plan keeps its current tier's limits through the end of the
// already-paid cycle; the downgrade to FREE/ACTIVE happens exactly at the next
// rollover, not immediately — see approved plan §4. All other statuses pass
// through the rollover unchanged.
export function resolvePlanAfterRollover(plan: Plan, planStatus: PlanStatus): { plan: Plan; planStatus: PlanStatus } {
  if (planStatus === 'CANCELED') return { plan: 'FREE', planStatus: 'ACTIVE' };
  return { plan, planStatus };
}

export function isSchedulingAllowed(plan: Plan, frequency: ScheduleFrequency): boolean {
  return getPlanDefinition(plan).features.allowedScheduleFrequencies.includes(frequency);
}

// Case-scoped metrics (SOURCE_ADDED) key on the real caseId; user-scoped
// metrics (PIPELINE_RUN, IMAGE_GENERATION) key on a fixed sentinel — see the
// scopeKey column comment in schema.prisma for why this can't just be null.
export function scopeKeyFor(caseId: string | null): string {
  return caseId ?? USER_SCOPE;
}

// ── DB-touching orchestration ──────────────────────────────────────────────────

interface GatingUser {
  systemRole: SystemRole;
  plan: Plan;
  planStatus: PlanStatus;
  currentUsagePeriodEnd: Date;
  nextUsageResetAt: Date;
}

const gatingUserSelect = {
  systemRole: true, plan: true, planStatus: true,
  currentUsagePeriodEnd: true, nextUsageResetAt: true,
} as const;

// Lazily rolls the user's usage cycle over if it has expired — resetting every
// UsageCounter row for that user to 0 and applying the CANCELED→FREE/ACTIVE
// auto-downgrade in the same update. Called before every gate below so no
// caller needs to think about staleness.
export async function ensureCurrentPeriod(userId: string): Promise<GatingUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: gatingUserSelect });
  const now = new Date();
  if (!isPeriodExpired(user.currentUsagePeriodEnd, now)) return user;

  const resolved = resolvePlanAfterRollover(user.plan, user.planStatus);
  const { start, end } = computeNextPeriod(resolved.plan, now);

  return prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        plan: resolved.plan,
        planStatus: resolved.planStatus,
        currentUsagePeriodStart: start,
        currentUsagePeriodEnd: end,
        nextUsageResetAt: end,
      },
      select: gatingUserSelect,
    });
    await tx.usageCounter.updateMany({ where: { userId }, data: { count: 0 } });
    return updated;
  });
}

export function assertPlanUsable(user: Pick<GatingUser, 'systemRole' | 'planStatus'>): void {
  if (canBypassLimits(user.systemRole)) return;
  if (!isPlanUsable(user.planStatus)) throw new PlanNotUsableError(user.planStatus);
}

// Active-case cap is a live row count, not a UsageCounter metric — a case
// counts as "active" until archived or deleted, not until the next cycle
// reset. Lifecycle (ACTIVE/ARCHIVED) is independent of CaseStatus (pipeline
// progress) — a case can cycle through the pipeline stages many times while
// staying lifecycle-ACTIVE, so this must never filter on `status`.
//
// `client` defaults to the global prisma singleton but accepts a transaction
// client too — the atomic archive-then-reactivate flow (caseService.reactivateCase)
// must count active cases INSIDE the same transaction that just archived one,
// otherwise the count would race against its own uncommitted archive.
export async function countActiveCases(userId: string, client: Prisma.TransactionClient | PrismaClient = prisma): Promise<number> {
  return client.contentCase.count({ where: { userId, lifecycleStatus: 'ACTIVE' } });
}

export async function assertCaseLimit(
  userId: string,
  systemRole: SystemRole,
  plan: Plan,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<void> {
  if (canBypassLimits(systemRole)) return;
  const limit = getPlanDefinition(plan).limits.maxActiveCases;
  const activeCount = await countActiveCases(userId, client);
  if (activeCount >= limit) throw new CaseLimitError(limit);
}

export function assertSchedulingAllowed(systemRole: SystemRole, plan: Plan, frequency: ScheduleFrequency): void {
  if (canBypassLimits(systemRole)) return;
  if (!isSchedulingAllowed(plan, frequency)) throw new SchedulingNotAllowedError();
}

// The core metering primitive. Atomically checks-and-increments in one SQL
// statement (INSERT ... ON CONFLICT ... WHERE count < limit) so two concurrent
// requests against a user with exactly 1 unit remaining can never both
// succeed — no separate read-then-write race window.
export async function checkAndIncrementUsage(userId: string, metric: UsageMetric, caseId: string | null = null): Promise<void> {
  const user = await ensureCurrentPeriod(userId);
  assertPlanUsable(user);
  if (canBypassLimits(user.systemRole)) return;

  const limit = getUsageLimit(user.plan, metric);
  const scopeKey = scopeKeyFor(caseId);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "usage_counters" ("id", "userId", "contentCaseId", "scopeKey", "metric", "count", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${caseId}, ${scopeKey}, ${metric}::"UsageMetric", 1, now())
    ON CONFLICT ("userId", "scopeKey", "metric")
    DO UPDATE SET "count" = "usage_counters"."count" + 1, "updatedAt" = now()
    WHERE "usage_counters"."count" < ${limit}
    RETURNING "count"
  `;

  if (rows.length === 0) throw new QuotaExceededError(metric, limit, user.nextUsageResetAt);
}

// Read-only "would this be blocked right now" check for a user-scoped metric —
// does NOT increment. Used by pipeline preflight for a synchronous 403 before
// the detached runner starts, mirroring how preflight already best-effort
// duplicates the already_running/no_new_sources guards that startRun (via
// checkAndIncrementUsage) enforces authoritatively. A race between peek and
// the real increment is harmless, same as preflight's existing guards: the
// authoritative check inside startRun still applies.
export async function peekUsage(userId: string, metric: UsageMetric): Promise<{ ok: true } | { ok: false; error: QuotaExceededError }> {
  const user = await ensureCurrentPeriod(userId);
  if (canBypassLimits(user.systemRole)) return { ok: true };

  const limit = getUsageLimit(user.plan, metric);
  const row = await prisma.usageCounter.findUnique({
    where: { userId_scopeKey_metric: { userId, scopeKey: USER_SCOPE, metric } },
  });
  const used = row?.count ?? 0;
  if (used >= limit) return { ok: false, error: new QuotaExceededError(metric, limit, user.nextUsageResetAt) };
  return { ok: true };
}

// ── Read-only reporting (Phase 3 — Settings "Plan & Usage" dashboard) ────────
// These never increment anything and are safe to call regardless of
// ENFORCE_QUOTAS; they only report what getUsageSummary/getCaseSourceUsage
// finds, using ensureCurrentPeriod so the numbers are never stale.

export interface UsageMetricSummary { used: number; limit: number }
export interface UsageSummary {
  plan: Plan;
  planStatus: PlanStatus;
  nextUsageResetAt: string;
  cases: UsageMetricSummary;
  // PIPELINE_RUN/IMAGE_GENERATION are user-scoped, so `used` here is exact.
  // SOURCE_ADDED is enforced PER CASE, so `used` is a sum across all of the
  // user's cases this cycle — informational only, not a strict ratio against
  // the per-case `limit` (see getCaseSourceUsage for the true per-case number,
  // used by the Sources panel's own disabled-state check).
  metrics: Record<UsageMetric, UsageMetricSummary>;
}

const ALL_METRICS: UsageMetric[] = ['PIPELINE_RUN', 'SOURCE_ADDED', 'IMAGE_GENERATION'];

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const user = await ensureCurrentPeriod(userId);
  const def = getPlanDefinition(user.plan);
  const [activeCases, counters] = await Promise.all([
    countActiveCases(userId),
    prisma.usageCounter.findMany({ where: { userId }, select: { metric: true, count: true } }),
  ]);

  const metrics = Object.fromEntries(
    ALL_METRICS.map(metric => [
      metric,
      {
        used: counters.filter(c => c.metric === metric).reduce((sum, c) => sum + c.count, 0),
        limit: def.limits.perMetric[metric],
      },
    ]),
  ) as Record<UsageMetric, UsageMetricSummary>;

  return {
    plan: user.plan,
    planStatus: user.planStatus,
    nextUsageResetAt: user.nextUsageResetAt.toISOString(),
    cases: { used: activeCases, limit: def.limits.maxActiveCases },
    metrics,
  };
}

// True per-case SOURCE_ADDED usage — used by the Sources panel's disabled-state
// check, where (unlike the Settings summary) there's exactly one case in scope
// so the used/limit ratio is meaningful.
export async function getCaseSourceUsage(userId: string, caseId: string): Promise<UsageMetricSummary> {
  const user = await ensureCurrentPeriod(userId);
  const limit = getUsageLimit(user.plan, 'SOURCE_ADDED');
  const row = await prisma.usageCounter.findUnique({
    where: { userId_scopeKey_metric: { userId, scopeKey: caseId, metric: 'SOURCE_ADDED' } },
  });
  return { used: row?.count ?? 0, limit };
}
