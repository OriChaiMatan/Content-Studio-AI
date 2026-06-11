import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { caseService } from '../../services/caseService';
import { createCaseSchema, updateCaseSchema } from '../../schemas/caseSchemas';
import { requireCaseOwnership } from '../middleware/auth';

const router = Router();

// Phase 12 — STRICT ownership: any route with :id is gated. A case that does not
// exist OR belongs to another user returns 404 (never 403, no existence leak).
router.param('id', requireCaseOwnership);

// ── GET /api/cases ────────────────────────────────────────────────────────────
// Returns all cases sorted by updatedAt DESC.
// Supports ?status= and ?q= query parameters for filtering.

router.get('/', async (req: Request, res: Response) => {
  try {
    let cases = await caseService.listCases(req.userId!);

    // Optional server-side filter by status
    const { status, q } = req.query as Record<string, string | undefined>;
    if (status) {
      cases = cases.filter(c => c.status === status);
    }
    if (q) {
      const lower = q.toLowerCase();
      cases = cases.filter(
        c =>
          c.title.toLowerCase().includes(lower) ||
          c.industry.toLowerCase().includes(lower),
      );
    }

    res.json({ cases });
  } catch (err) {
    console.error('[GET /api/cases]', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// ── GET /api/cases/:id ────────────────────────────────────────────────────────
// Returns one case with full nested data (sources, outputs, pipeline).

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const c = await caseService.getCaseById(req.params.id, req.userId!);
    if (!c) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    res.json(c);
  } catch (err) {
    console.error('[GET /api/cases/:id]', err);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// ── POST /api/cases ───────────────────────────────────────────────────────────
// Creates a new case with optional initial sources.
// Always creates the 3 pipeline steps (research, fact_check, content_creation).

router.post('/', async (req: Request, res: Response) => {
  try {
    const input = createCaseSchema.parse(req.body);
    const c = await caseService.createCase(input, req.userId!);
    res.status(201).json(c);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/cases]', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// ── PATCH /api/cases/:id ──────────────────────────────────────────────────────
// Partial update of case settings. All fields are optional.

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const input = updateCaseSchema.parse(req.body);
    const c = await caseService.updateCase(req.params.id, input);
    res.json(c);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[PATCH /api/cases/:id]', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// ── DELETE /api/cases/:id ─────────────────────────────────────────────────────
// Hard-deletes the case. Cascade deletes all related rows.

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await caseService.deleteCase(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /api/cases/:id]', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

export default router;
