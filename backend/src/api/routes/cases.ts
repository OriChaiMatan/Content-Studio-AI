import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Plan, SystemRole } from '@prisma/client';
import { ZodError } from 'zod';
import { caseService } from '../../services/caseService';
import { createCaseSchema, updateCaseSchema, reactivateCaseSchema } from '../../schemas/caseSchemas';
import { requireCaseOwnership, requireActiveCase } from '../middleware/auth';
import { quotaConfig } from '../../lib/quotaConfig';
import { ensureCurrentPeriod, assertPlanUsable, assertCaseLimit, assertSchedulingAllowed } from '../../services/usageService';
import { isQuotaError, sendQuotaError } from '../../lib/quotaErrors';

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
    if (quotaConfig.enforceQuotas) {
      const user = await ensureCurrentPeriod(req.userId!);
      assertPlanUsable(user);
      await assertCaseLimit(req.userId!, user.systemRole, user.plan);
    }
    const c = await caseService.createCase(input, req.userId!);
    res.status(201).json(c);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (isQuotaError(err)) {
      sendQuotaError(res, err);
      return;
    }
    console.error('[POST /api/cases]', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// ── PATCH /api/cases/:id ──────────────────────────────────────────────────────
// Partial update of case settings. All fields are optional.

router.patch('/:id', requireActiveCase, async (req: Request, res: Response) => {
  try {
    const input = updateCaseSchema.parse(req.body);
    if (quotaConfig.enforceQuotas && input.scheduleFrequency !== undefined) {
      const user = await ensureCurrentPeriod(req.userId!);
      assertPlanUsable(user);
      assertSchedulingAllowed(user.systemRole, user.plan, input.scheduleFrequency);
    }
    const c = await caseService.updateCase(req.params.id, input);
    res.json(c);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (isQuotaError(err)) {
      sendQuotaError(res, err);
      return;
    }
    console.error('[PATCH /api/cases/:id]', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// ── POST /api/cases/:id/archive ───────────────────────────────────────────────
// Explicit, user-initiated lifecycle transition to ARCHIVED. Never automatic.
// Archiving only ever frees a quota slot, so no quota check is needed here.
// Idempotent: archiving an already-archived case is a no-op success (doesn't
// bump archivedAt again) rather than an error.

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    if (req.caseLifecycleStatus === 'ARCHIVED') {
      const c = await caseService.getCaseById(req.params.id, req.userId!);
      res.json(c);
      return;
    }
    const c = await caseService.archiveCase(req.params.id);
    res.json(c);
  } catch (err) {
    console.error('[POST /api/cases/:id/archive]', err);
    res.status(500).json({ error: 'Failed to archive case' });
  }
});

// ── POST /api/cases/:id/reactivate ────────────────────────────────────────────
// Explicit, user-initiated lifecycle transition back to ACTIVE. Enforces the
// active-case plan limit (MASTER bypasses; Pro reactivates freely while under
// its higher cap). Optional body.archiveCaseId is the Free-plan conflict-flow
// swap: archive that case and reactivate this one atomically (see caseService).
// Idempotent — already-ACTIVE is a no-op success.

router.post('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const { archiveCaseId } = reactivateCaseSchema.parse(req.body ?? {});
    let systemRole: SystemRole = 'USER';
    let plan: Plan = 'FREE';
    if (quotaConfig.enforceQuotas) {
      const user = await ensureCurrentPeriod(req.userId!);
      assertPlanUsable(user);
      systemRole = user.systemRole;
      plan = user.plan;
    }
    const c = await caseService.reactivateCase(
      req.params.id, req.userId!, systemRole, plan, archiveCaseId, quotaConfig.enforceQuotas,
    );
    res.json(c);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (isQuotaError(err)) {
      sendQuotaError(res, err);
      return;
    }
    if (err instanceof Error && err.message === 'archive_case_not_found') {
      res.status(404).json({ error: 'The case to archive was not found.' });
      return;
    }
    console.error('[POST /api/cases/:id/reactivate]', err);
    res.status(500).json({ error: 'Failed to reactivate case' });
  }
});

// ── DELETE /api/cases/:id ─────────────────────────────────────────────────────
// Hard-deletes the case. Cascade deletes all related rows. Available regardless
// of lifecycle status — a distinct, already-destructive, already-confirmed
// action outside the scope of the archive/read-only feature.

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
