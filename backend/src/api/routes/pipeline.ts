import { Router } from 'express';
import type { Request, Response } from 'express';
import { pipelineService } from '../../services/pipelineService';
import { requireCaseOwnership } from '../middleware/auth';

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

// ── POST /api/cases/:id/pipeline/start ───────────────────────────────────────
// Start a new pipeline run.
// Selects new sources as primary, used sources as context.
// Returns 400 with code 'no_new_sources' if no new sources are available.
// Returns 409 if a run is already in progress.

router.post('/:id/pipeline/start', async (req: Request, res: Response) => {
  try {
    const outputLanguage = typeof req.body?.outputLanguage === 'string' ? req.body.outputLanguage : undefined;
    const result = await pipelineService.startRun(req.params.id, outputLanguage);

    if (result.type === 'error') {
      const statusCode =
        result.code === 'case_not_found'  ? 404 :
        result.code === 'already_running' ? 409 :
        result.code === 'no_new_sources'  ? 400 : 500;
      res.status(statusCode).json({ error: result.code, message: result.message });
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

router.post('/:id/pipeline/advance', async (req: Request, res: Response) => {
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
