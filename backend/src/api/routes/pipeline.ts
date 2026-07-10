import { Router } from 'express';
import type { Request, Response } from 'express';
import { pipelineService } from '../../services/pipelineService';
import { pipelineRunnerService } from '../../services/pipelineRunnerService';
import { requireCaseOwnership, requireActiveCase } from '../middleware/auth';
import { aiHeavyLimiter } from '../middleware/rateLimit';

const router = Router();

// Phase 12 — STRICT ownership: pipeline runs only on the owner's case; else 404.
router.param('id', requireCaseOwnership);

// ── GET /api/cases/:id/pipeline ───────────────────────────────────────────────
// Lightweight pipeline status — steps + current run summary + source counts.
// Used for polling while a run is active.

router.get('/:id/pipeline', async (req: Request, res: Response) => {
  try {
    const status = await pipelineService.getStatus(req.params.id);
    if (!status) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    res.json(status);
  } catch (err) {
    console.error('[GET /api/cases/:id/pipeline]', err);
    res.status(500).json({ error: 'Failed to get pipeline status' });
  }
});

// ── POST /api/cases/:id/pipeline/run (Phase 14B) ─────────────────────────────
// Start the SERVER-SIDE runner for this case, detached, and return 202 immediately.
// The pipeline then runs start→advance×3 to completion in-process with no dependency
// on the browser (the client polls GET /cases/:id for progress). A synchronous
// pre-flight gives an immediate 404/409/400; the detached runner is best-effort and
// never crashes the server. Ownership is enforced by router.param above.
//
// The authoritative "already running" guard is the DB: preflight (and startRun
// inside the runner) reject a new run while one is 'running'. We deliberately do NOT
// keep an in-process lock — it produced spurious 409s when its lifetime drifted from
// the DB state (a quick second click, or a stale entry after an aborted run), while
// adding nothing over the DB guard: a redundant second runner simply no-ops via
// startRun's already_running. Removing it makes second+ generations reliable.
router.post('/:id/pipeline/run', requireActiveCase, aiHeavyLimiter, async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const outputLanguage = typeof req.body?.outputLanguage === 'string' ? req.body.outputLanguage : undefined;
  try {
    const pre = await pipelineService.preflight(caseId);
    if (!pre.ok) {
      const statusCode =
        pre.code === 'case_not_found'   ? 404 :
        pre.code === 'already_running'  ? 409 :
        pre.code === 'no_new_sources'   ? 400 :
        pre.code === 'quota_exceeded'   ? 403 :
        pre.code === 'plan_not_usable'  ? 403 : 500;
      res.status(statusCode).json({
        error: pre.message ?? pre.code, code: pre.code,
        ...(pre.metric ? { metric: pre.metric, resetAt: pre.resetAt, limit: pre.limit } : {}),
      });
      return;
    }

    // Detach the runner — do NOT await. runToCompletion never throws; .catch is a
    // backstop so an unexpected rejection can never crash the server.
    void pipelineRunnerService
      .runToCompletion(caseId, { outputLanguage })
      .then(result => {
        if (result.status !== 'completed') {
          console.log('[POST /pipeline/run] detached runner finished', JSON.stringify({ caseId, status: result.status, code: result.code }));
        }
      })
      .catch(err => console.error('[POST /pipeline/run] detached runner error', caseId, err instanceof Error ? err.message : err));

    res.status(202).json({ accepted: true, caseId });
  } catch (err) {
    console.error('[POST /api/cases/:id/pipeline/run]', err);
    res.status(500).json({ error: 'Failed to start pipeline run' });
  }
});

// ── POST /api/cases/:id/pipeline/start ───────────────────────────────────────
// Start a new pipeline run.
// Selects new sources as primary, used sources as context.
// Returns 400 with code 'no_new_sources' if no new sources are available.
// Returns 409 if a run is already in progress.

router.post('/:id/pipeline/start', requireActiveCase, aiHeavyLimiter, async (req: Request, res: Response) => {
  try {
    const outputLanguage = typeof req.body?.outputLanguage === 'string' ? req.body.outputLanguage : undefined;
    const result = await pipelineService.startRun(req.params.id, outputLanguage);

    if (result.type === 'error') {
      const statusCode =
        result.code === 'case_not_found'  ? 404 :
        result.code === 'already_running' ? 409 :
        result.code === 'no_new_sources'  ? 400 :
        result.code === 'quota_exceeded'  ? 403 :
        result.code === 'plan_not_usable' ? 403 : 500;
      res.status(statusCode).json({
        error: result.message, code: result.code,
        ...('metric' in result && result.metric ? { metric: result.metric, resetAt: result.resetAt, limit: result.limit } : {}),
      });
      return;
    }

    res.status(201).json(result.case);
  } catch (err) {
    console.error('[POST /api/cases/:id/pipeline/start]', err);
    res.status(500).json({ error: 'Failed to start pipeline run' });
  }
});

// ── POST /api/cases/:id/pipeline/advance ─────────────────────────────────────
// Advance the active run one step (used by the frontend timer simulation).
// Completes the currently-running step and starts the next one.
// On content_creation completion: creates mock outputs, completes run.

router.post('/:id/pipeline/advance', requireActiveCase, aiHeavyLimiter, async (req: Request, res: Response) => {
  try {
    const result = await pipelineService.advanceRun(req.params.id);

    if (result.type === 'error') {
      const statusCode = result.code === 'case_not_found' ? 404 : 400;
      res.status(statusCode).json({ error: result.code, message: result.message });
      return;
    }

    res.json(result.case);
  } catch (err) {
    console.error('[POST /api/cases/:id/pipeline/advance]', err);
    res.status(500).json({ error: 'Failed to advance pipeline run' });
  }
});

export default router;
