import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBypassLimits, isPlanUsable, isPeriodExpired, computeNextPeriod,
  resolvePlanAfterRollover, isSchedulingAllowed, scopeKeyFor,
} from './usageService';

// ── MASTER bypass ─────────────────────────────────────────────────────────────

test('canBypassLimits: MASTER bypasses, USER does not', () => {
  assert.equal(canBypassLimits('MASTER'), true);
  assert.equal(canBypassLimits('USER'), false);
});

// ── Plan status usability ─────────────────────────────────────────────────────

test('isPlanUsable: SUSPENDED is the only non-usable status', () => {
  assert.equal(isPlanUsable('ACTIVE'), true);
  assert.equal(isPlanUsable('CANCELED'), true);
  assert.equal(isPlanUsable('PAST_DUE'), true);
  assert.equal(isPlanUsable('TRIAL'), true);
  assert.equal(isPlanUsable('SUSPENDED'), false);
});

// ── Cycle expiry + rollover ────────────────────────────────────────────────────

test('isPeriodExpired: false before the boundary, true at/after it', () => {
  const end = new Date('2026-07-16T00:00:00.000Z');
  assert.equal(isPeriodExpired(end, new Date('2026-07-15T23:59:59.999Z')), false);
  assert.equal(isPeriodExpired(end, new Date('2026-07-16T00:00:00.000Z')), true);
  assert.equal(isPeriodExpired(end, new Date('2026-08-01T00:00:00.000Z')), true);
});

test('computeNextPeriod: FREE is a 7-day window starting at `now`, not the old boundary', () => {
  const now = new Date('2026-07-20T10:00:00.000Z'); // long after any hypothetical prior boundary
  const { start, end } = computeNextPeriod('FREE', now);
  assert.equal(start.toISOString(), now.toISOString());
  assert.equal(end.toISOString(), '2026-07-27T10:00:00.000Z');
});

test('computeNextPeriod: PRO is a 30-day window starting at `now`', () => {
  const now = new Date('2026-07-20T10:00:00.000Z');
  const { start, end } = computeNextPeriod('PRO', now);
  assert.equal(start.toISOString(), now.toISOString());
  assert.equal(end.toISOString(), '2026-08-19T10:00:00.000Z');
});

test('computeNextPeriod: snap-to-now, not catch-up — inactivity far beyond one cycle still yields exactly one fresh window', () => {
  // Simulates a Free user inactive for ~40 days: whatever the stale boundary
  // was, the new period is simply now -> now+7d, never a sequence of 7-day
  // advances toward `now`.
  const now = new Date('2026-09-01T00:00:00.000Z');
  const { start, end } = computeNextPeriod('FREE', now);
  assert.equal(start.toISOString(), now.toISOString());
  assert.equal(end.toISOString(), '2026-09-08T00:00:00.000Z');
});

// ── CANCELED auto-downgrade at rollover ───────────────────────────────────────

test('resolvePlanAfterRollover: CANCELED becomes FREE/ACTIVE exactly at rollover', () => {
  assert.deepEqual(resolvePlanAfterRollover('PRO', 'CANCELED'), { plan: 'FREE', planStatus: 'ACTIVE' });
});

test('resolvePlanAfterRollover: every other status/plan combination passes through unchanged', () => {
  assert.deepEqual(resolvePlanAfterRollover('FREE', 'ACTIVE'), { plan: 'FREE', planStatus: 'ACTIVE' });
  assert.deepEqual(resolvePlanAfterRollover('PRO', 'ACTIVE'), { plan: 'PRO', planStatus: 'ACTIVE' });
  assert.deepEqual(resolvePlanAfterRollover('PRO', 'PAST_DUE'), { plan: 'PRO', planStatus: 'PAST_DUE' });
  assert.deepEqual(resolvePlanAfterRollover('PRO', 'SUSPENDED'), { plan: 'PRO', planStatus: 'SUSPENDED' });
});

// ── Scheduling restriction ─────────────────────────────────────────────────────

test('isSchedulingAllowed: manual, weekly, and monthly are allowed on every plan', () => {
  assert.equal(isSchedulingAllowed('FREE', 'manual'), true);
  assert.equal(isSchedulingAllowed('FREE', 'weekly'), true);
  assert.equal(isSchedulingAllowed('FREE', 'monthly'), true);
  assert.equal(isSchedulingAllowed('PRO', 'manual'), true);
  assert.equal(isSchedulingAllowed('PRO', 'weekly'), true);
  assert.equal(isSchedulingAllowed('PRO', 'monthly'), true);
});

test('isSchedulingAllowed: daily is Free-blocked, Pro-allowed', () => {
  assert.equal(isSchedulingAllowed('FREE', 'daily'), false);
  assert.equal(isSchedulingAllowed('PRO', 'daily'), true);
});

// ── scopeKey generation ────────────────────────────────────────────────────────

test('scopeKeyFor: a real caseId passes through; null becomes the "user" sentinel', () => {
  assert.equal(scopeKeyFor('case-123'), 'case-123');
  assert.equal(scopeKeyFor(null), 'user');
});
