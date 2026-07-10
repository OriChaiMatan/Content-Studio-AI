import { prisma } from '../lib/prisma';
import { pipelineRunnerService } from './pipelineRunnerService';

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight in-process scheduler (Phase 14C)
//
// Default OFF (SCHEDULER_ENABLED). When on, ticks every SCHEDULER_INTERVAL_MINUTES:
//   1. find non-manual, active cases whose scheduled slot is due NOW (in
//      SCHEDULER_TIMEZONE) and not already processed
//   2. consume the slot (lastScheduledSlotKey) and, if eligible (>=1 new source,
//      no running run), launch pipelineRunnerService.runToCompletion detached with
//      triggeredBy='schedule'.
//
// Stuck-run reaping is NOT owned here (Phase 14D) — see pipelineRunReaperService,
// which runs always-on, independent of SCHEDULER_ENABLED.
//
// No cron/BullMQ/Redis/workers. No pipeline logic duplicated. Never backfills missed
// slots (the due window is exactly one tick interval). The 13E review-ready WhatsApp
// notification fires automatically when a scheduled run completes (inside advanceRun).
// ─────────────────────────────────────────────────────────────────────────────

export const schedulerConfig = {
  enabled:         process.env.SCHEDULER_ENABLED === 'true',
  intervalMinutes: Math.max(1, parseInt(process.env.SCHEDULER_INTERVAL_MINUTES ?? '15', 10)),
  timezone:        process.env.SCHEDULER_TIMEZONE ?? 'Asia/Jerusalem',
} as const;

// ── Pure time helpers (exported for testing) ──────────────────────────────────

export interface LocalNowParts {
  localDate:     string;  // "YYYY-MM-DD" in tz
  minutesOfDay:  number;  // 0..1439, local wall-clock (DST-correct)
  dayOfWeek:     number;  // 0 (Sun) .. 6 (Sat)
  dayOfMonth:    number;  // 1..31
}

// Read local wall-clock parts for a timezone using Intl (no library; DST-correct).
export function localNowParts(timezone: string, now: Date = new Date()): LocalNowParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;   // some environments render midnight as 24
  const minute = parseInt(get('minute'), 10);
  // Day-of-week of a calendar date is timezone-independent → derive via UTC.
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    localDate:    `${get('year')}-${get('month')}-${get('day')}`,
    minutesOfDay: hour * 60 + minute,
    dayOfWeek,
    dayOfMonth:   day,
  };
}

// Parse "HH:MM" → minutes of day, or null if invalid.
export function parseHHMM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Minimal shape the scheduler reasons about.
export interface SchedulableCase {
  id:                   string;
  scheduleFrequency:    string;          // 'daily' | 'weekly' | 'monthly' (manual filtered out)
  scheduleTime:         string | null;
  scheduleDayOfWeek:    number | null;
  scheduleDayOfMonth:   number | null;
  language:             string;
  lastScheduledSlotKey: string | null;
}

// Unique key of the current scheduled occurrence — local date makes it unique.
export function computeSlotKey(c: SchedulableCase, parts: LocalNowParts): string {
  return `${parts.localDate}|${c.scheduleFrequency}|${c.scheduleTime ?? ''}`;
}

// Is this case's scheduled slot due right now? Window = one tick interval (so a server
// that boots AFTER the window is not due → no backfill). Monthly day-of-month that does
// not exist in the current month simply never matches parts.dayOfMonth → skipped.
export function isDue(c: SchedulableCase, parts: LocalNowParts, intervalMinutes: number): boolean {
  if (c.scheduleFrequency === 'manual') return false;
  const slotMinutes = parseHHMM(c.scheduleTime);
  if (slotMinutes === null) return false;

  const timeWindowDue = parts.minutesOfDay >= slotMinutes && parts.minutesOfDay < slotMinutes + intervalMinutes;
  if (!timeWindowDue) return false;

  if (c.scheduleFrequency === 'daily')   return true;
  if (c.scheduleFrequency === 'weekly')  return c.scheduleDayOfWeek === parts.dayOfWeek;
  if (c.scheduleFrequency === 'monthly') return c.scheduleDayOfMonth === parts.dayOfMonth;
  return false;
}

// Stuck-run reaping is no longer owned by the scheduler (Phase 14D) — it lives in
// pipelineRunReaperService and runs always-on, independent of SCHEDULER_ENABLED.

// ── Candidate query ───────────────────────────────────────────────────────────
async function findCandidates() {
  return prisma.contentCase.findMany({
    where: {
      scheduleFrequency: { not: 'manual' },
      lifecycleStatus:   'ACTIVE',
      scheduleTime:      { not: null },
    },
    select: {
      id: true, scheduleFrequency: true, scheduleTime: true,
      scheduleDayOfWeek: true, scheduleDayOfMonth: true, language: true, lastScheduledSlotKey: true,
      sources:      { where: { status: 'new' },     select: { id: true }, take: 1 },
      pipelineRuns: { where: { status: 'running' }, select: { id: true }, take: 1 },
    },
  });
}

// ── Tick (exported for testing) ───────────────────────────────────────────────
let ticking = false;

export async function tick(): Promise<{ due: number; launched: number }> {
  if (ticking) {
    console.log('[scheduler] tick skipped — previous tick still running');
    return { due: 0, launched: 0 };
  }
  ticking = true;
  let due = 0, launched = 0;
  try {
    const parts = localNowParts(schedulerConfig.timezone);
    const candidates = await findCandidates();

    for (const c of candidates) {
      try {
        if (!isDue(c as SchedulableCase, parts, schedulerConfig.intervalMinutes)) continue;
        const slotKey = computeSlotKey(c as SchedulableCase, parts);
        if (c.lastScheduledSlotKey === slotKey) continue;   // already processed this slot
        due++;

        // Consume-on-due: mark the slot BEFORE launching so it fires at most once even
        // across overlapping ticks; if this write fails we skip (no double-run).
        await prisma.contentCase.update({ where: { id: c.id }, data: { lastScheduledSlotKey: slotKey } });

        const hasNew  = c.sources.length > 0;
        const running = c.pipelineRuns.length > 0;
        if (!hasNew || running) {
          console.log(`[scheduler] slot consumed, no run (case=${c.id} slot=${slotKey} hasNew=${hasNew} running=${running})`);
          continue;
        }

        // Launch detached — runner guards (no_new_sources/already_running) make this safe.
        void pipelineRunnerService
          .runToCompletion(c.id, { triggeredBy: 'schedule', outputLanguage: c.language })
          .then(r => console.log(`[scheduler] scheduled run finished (case=${c.id} slot=${slotKey} status=${r.status})`))
          .catch(err => console.error('[scheduler] scheduled run error', c.id, err instanceof Error ? err.message : err));
        launched++;
      } catch (err) {
        console.error('[scheduler] per-case error', c.id, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[scheduler] tick error', err instanceof Error ? err.message : err);
  } finally {
    ticking = false;
  }
  return { due, launched };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let timer: ReturnType<typeof setInterval> | null = null;

export const schedulerService = {
  start(): void {
    if (!schedulerConfig.enabled) {
      console.log('[scheduler] disabled (SCHEDULER_ENABLED!=true) — not started');
      return;
    }
    if (timer) return;   // already started
    console.log(`[scheduler] started — every ${schedulerConfig.intervalMinutes}m, tz=${schedulerConfig.timezone}`);
    // Immediate tick (catches a slot near boot; idempotent, never backfills past slots).
    void tick();
    timer = setInterval(() => { void tick(); }, schedulerConfig.intervalMinutes * 60_000);
  },

  stop(): void {
    if (timer) { clearInterval(timer); timer = null; }
  },
};
