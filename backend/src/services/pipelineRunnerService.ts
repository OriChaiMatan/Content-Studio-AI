import { prisma } from '../lib/prisma';
import { pipelineService } from './pipelineService';
import { PIPELINE_STEP_ORDER } from '../schemas/pipelineSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Server-side pipeline runner (Phase 14A)
//
// Drives a case pipeline from start to finish IN-PROCESS, with no dependency on
// the frontend timer or an open browser tab. It is a thin orchestrator over the
// existing pipelineService: startRun once, then advanceRun until the run is
// completed or failed. ALL pipeline behavior — source selection, AI/content
// generation, and the 13E review-ready WhatsApp notification (fired detached
// inside advanceRun) — is preserved unchanged; this file adds no business logic.
//
// Dependency is one-way (pipelineRunnerService → pipelineService); pipelineService
// must never import this. Not wired to any route/scheduler in 14A.
// ─────────────────────────────────────────────────────────────────────────────

export interface RunToCompletionOptions {
  outputLanguage?: string;   // 'en' | 'he' — forwarded to startRun (validated there)
  maxAdvances?: number;      // loop guard; defaults to PIPELINE_STEP_ORDER.length + 1
}

export interface RunResult {
  status: 'completed' | 'failed' | 'not_started' | 'error';
  caseId: string;
  runId: string | null;
  caseStatus?: string;       // e.g. 'in_review' on completion
  outputCount?: number;      // run-scoped, present on completion
  stepsAdvanced: number;
  code?: string;             // start/advance error code, or runner code
  message?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// Best-effort terminal-state safety: if the runner exits non-terminally after a
// run was created (max guard hit, or an unexpected throw), flip a still-'running'
// run to 'failed' so the case is never permanently locked by startRun's
// already_running guard. Guarded on status:'running' → no-op if already terminal.
async function bestEffortMarkFailed(runId: string, reason: string): Promise<void> {
  try {
    await prisma.pipelineRun.updateMany({
      where: { id: runId, status: 'running' },
      data:  { status: 'failed', completedAt: new Date(), errorMessage: reason },
    });
  } catch (err) {
    console.error('[pipelineRunner] bestEffortMarkFailed failed', err instanceof Error ? err.message : err);
  }
}

export const pipelineRunnerService = {
  // Never throws — always resolves to a RunResult. Safe to call from Generate Now
  // (14B) or the scheduler (14C).
  async runToCompletion(caseId: string, options: RunToCompletionOptions = {}): Promise<RunResult> {
    const startedAt = new Date();
    const finish = (r: Omit<RunResult, 'caseId' | 'startedAt' | 'finishedAt' | 'durationMs'>): RunResult => {
      const finishedAt = new Date();
      return {
        caseId,
        startedAt:  startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ...r,
      };
    };

    let runId: string | null = null;

    try {
      // ── Start the run (snapshots sources; sets research → running) ────────────
      const start = await pipelineService.startRun(caseId, options.outputLanguage);
      if (start.type === 'error') {
        // case_not_found | already_running | no_new_sources — no run created.
        return finish({ status: 'not_started', runId: null, stepsAdvanced: 0, code: start.code, message: start.message });
      }
      runId = start.case.currentRun?.id ?? null;

      const maxAdvances = options.maxAdvances ?? (PIPELINE_STEP_ORDER.length + 1);

      // ── Advance until terminal, bounded by the guard ──────────────────────────
      for (let stepsAdvanced = 1; stepsAdvanced <= maxAdvances; stepsAdvanced++) {
        const adv = await pipelineService.advanceRun(caseId);

        if (adv.type === 'error') {
          // advanceRun already marked the run 'failed' on contract failures and
          // wrote no partial outputs. No 13E notification fires on failure.
          return finish({ status: 'failed', runId, stepsAdvanced: stepsAdvanced - 1, code: adv.code, message: adv.message });
        }

        const runStatus = adv.case.currentRun?.status;
        if (runStatus === 'completed') {
          // 13E notification was fired (detached) inside advanceRun's content_creation
          // branch — nothing to do here.
          const outputCount = runId
            ? await prisma.contentOutput.count({ where: { pipelineRunId: runId } })
            : 0;
          return finish({ status: 'completed', runId, caseStatus: adv.case.status, outputCount, stepsAdvanced });
        }
        if (runStatus === 'failed') {
          return finish({ status: 'failed', runId, stepsAdvanced, code: 'run_failed' });
        }
        // still 'running' → continue to the next step
      }

      // Guard exhausted without reaching a terminal state — force terminal.
      if (runId) await bestEffortMarkFailed(runId, 'max_steps_exceeded');
      return finish({ status: 'error', runId, stepsAdvanced: maxAdvances, code: 'max_steps_exceeded' });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown runner error';
      console.error('[pipelineRunner] runToCompletion error', caseId, message);
      if (runId) await bestEffortMarkFailed(runId, `unexpected_error: ${message}`);
      return finish({ status: 'error', runId, stepsAdvanced: 0, code: 'unexpected_error', message });
    }
  },
};
