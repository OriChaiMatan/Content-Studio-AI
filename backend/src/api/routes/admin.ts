import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireMaster } from '../middleware/auth';
import { updateUserPlanSchema } from '../../schemas/adminSchemas';
import { computeNextPeriod } from '../../services/usageService';

const router = Router();

// Every route here requires the MASTER systemRole (see requireMaster) — never
// hardcoded users, granted only via the MASTER_EMAILS env var (see lib/masterEmails.ts).
router.use(requireMaster);

const userPlanSelect = {
  id: true, email: true, name: true, plan: true, planStatus: true,
  planStartedAt: true, currentUsagePeriodStart: true, currentUsagePeriodEnd: true, nextUsageResetAt: true,
} satisfies Prisma.UserSelect;

// ── PATCH /api/admin/users/:id/plan ───────────────────────────────────────────
// Change a user's plan and/or planStatus. Per the approved plan (§9): changing
// `plan` ALWAYS starts a fresh usage cycle immediately (new planStartedAt,
// reset period, all UsageCounter rows zeroed) — this applies uniformly to
// upgrades and admin-initiated downgrades, never prorating the old cycle.
// Changing only `planStatus` (e.g. un-suspending someone) does NOT touch the
// usage cycle — it just restores/revokes usability of whatever cycle is
// already in progress.
router.patch('/users/:id/plan', async (req: Request, res: Response) => {
  try {
    const input = updateUserPlanSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, plan: true } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const planChanged = input.plan !== undefined && input.plan !== target.plan;
    const data: Prisma.UserUpdateInput = {};
    if (input.planStatus !== undefined) data.planStatus = input.planStatus;
    if (planChanged) {
      const now = new Date();
      const { start, end } = computeNextPeriod(input.plan!, now);
      data.plan = input.plan;
      data.planStartedAt = now;
      data.currentUsagePeriodStart = start;
      data.currentUsagePeriodEnd = end;
      data.nextUsageResetAt = end;
    }

    const updated = await prisma.$transaction(async tx => {
      const u = await tx.user.update({ where: { id: req.params.id }, data, select: userPlanSelect });
      if (planChanged) {
        await tx.usageCounter.updateMany({ where: { userId: req.params.id }, data: { count: 0 } });
      }
      return u;
    });

    res.json({
      user: {
        ...updated,
        planStartedAt: updated.planStartedAt.toISOString(),
        currentUsagePeriodStart: updated.currentUsagePeriodStart.toISOString(),
        currentUsagePeriodEnd: updated.currentUsagePeriodEnd.toISOString(),
        nextUsageResetAt: updated.nextUsageResetAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[PATCH /api/admin/users/:id/plan]', err);
    res.status(500).json({ error: 'Failed to update user plan' });
  }
});

export default router;
