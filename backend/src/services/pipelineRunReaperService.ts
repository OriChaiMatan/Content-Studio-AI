import { prisma } from '../lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Stuck-run reaper (Phase 14D)
//
// Always-on, INDEPENDENT of the scheduler. A PipelineRun can be left stuck in
// status='running' if the process crashes mid-run (e.g. a detached manual
// /pipeline/run); that permanently blocks the case via startRun's already_running
// guard. This service periodically marks such stale runs as failed so the case is
// unblocked.
//
// Conservative by design: it ONLY flips status='running' rows older than the
// threshold to 'failed'. It never touches completed/failed runs, never touches case
// status/steps, and never starts/retries a pipeline. It runs even when
// SCHEDULER_ENABLED=false (gated by its own REAPER_ENABLED, default true).
// ─────────────────────────────────────────────────────────────────────────────

export const reaperConfig = {
  enabled:         process.env.REAPER_ENABLED !== 'false',   // default ON
  intervalMinutes: Math.max(1, parseInt(process.env.REAPER_INTERVAL_MINUTES ?? '10', 10)),
  // Threshold reuses SCHEDULER_STUCK_RUN_MINUTES (default 30) — single source of truth
  // for "how long until a 'running' run is considered stuck".
  stuckRunMinutes: Math.max(1, parseInt(process.env.SCHEDULER_STUCK_RUN_MINUTES ?? '30', 10)),
} as const;

// Mark runs stuck in 'running' beyond thresholdMinutes as failed. Returns the count.
// Idempotent and safe to call repeatedly.
export async function reapStuckRuns(thresholdMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
  const res = await prisma.pipelineRun.updateMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    data:  { status: 'failed', completedAt: new Date(), errorMessage: 'Run exceeded max duration; marked failed by stuck-run reaper.' },
  });
  if (res.count > 0) console.log(`[reaper] marked ${res.count} stuck run(s) failed (>${thresholdMinutes}m)`);
  return res.count;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

// One reap pass — overlap-guarded, never throws.
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await reapStuckRuns(reaperConfig.stuckRunMinutes);
  } catch (err) {
    console.error('[reaper] reap failed', err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

export const pipelineRunReaperService = {
  start(): void {
    if (!reaperConfig.enabled) {
      console.log('[reaper] disabled (REAPER_ENABLED=false) — not started');
      return;
    }
    if (timer) return;   // already started
    console.log(`[reaper] started — every ${reaperConfig.intervalMinutes}m, threshold ${reaperConfig.stuckRunMinutes}m`);
    // Immediate pass on boot: clear anything already stuck from a previous crash.
    void tick();
    timer = setInterval(() => { void tick(); }, reaperConfig.intervalMinutes * 60_000);
  },

  stop(): void {
    if (timer) { clearInterval(timer); timer = null; }
  },
};
