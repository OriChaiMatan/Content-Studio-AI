import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { outputService } from '../../services/outputService';
import { updateOutputBodySchema, updateOutputStatusSchema } from '../../schemas/outputSchemas';
import { requireCaseOwnership } from '../middleware/auth';

const router = Router();

// Phase 12 — STRICT ownership: outputs are scoped to the owning case (:caseId); else 404.
router.param('caseId', requireCaseOwnership);

// ── PATCH /api/cases/:caseId/outputs/:outputId ───────────────────────────────
// Edit the body (and optionally title) of a draft output.

router.patch('/:caseId/outputs/:outputId', async (req: Request, res: Response) => {
  try {
    const input  = updateOutputBodySchema.parse(req.body);
    const output = await outputService.updateBody(req.params.caseId, req.params.outputId, input);
    if (!output) { res.status(404).json({ error: 'Output not found' }); return; }
    res.json(output);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    console.error('[PATCH /outputs/:id]', err);
    res.status(500).json({ error: 'Failed to update output' });
  }
});

// ── PATCH /api/cases/:caseId/outputs/:outputId/status ───────────────────────
// Approve or reject an output.
// On approval: creates LibraryItem, marks primary sources used (first approval for run).
// On rejection: removes LibraryItem if it existed.

router.patch('/:caseId/outputs/:outputId/status', async (req: Request, res: Response) => {
  try {
    const input  = updateOutputStatusSchema.parse(req.body);
    const output = await outputService.updateStatus(req.params.caseId, req.params.outputId, input);
    if (!output) { res.status(404).json({ error: 'Output not found' }); return; }
    res.json(output);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    console.error('[PATCH /outputs/:id/status]', err);
    res.status(500).json({ error: 'Failed to update output status' });
  }
});

// ── POST /api/cases/:caseId/outputs/:outputId/regenerate ─────────────────────
// Reset output to draft with bumped version. Sources are not affected.

router.post('/:caseId/outputs/:outputId/regenerate', async (req: Request, res: Response) => {
  try {
    const output = await outputService.regenerate(req.params.caseId, req.params.outputId);
    if (!output) { res.status(404).json({ error: 'Output not found' }); return; }
    res.json(output);
  } catch (err) {
    console.error('[POST /outputs/:id/regenerate]', err);
    res.status(500).json({ error: 'Failed to regenerate output' });
  }
});

export default router;
