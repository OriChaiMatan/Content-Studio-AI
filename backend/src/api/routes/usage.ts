import { Router } from 'express';
import type { Request, Response } from 'express';
import { getUsageSummary } from '../../services/usageService';

const router = Router();

// ── GET /api/usage ────────────────────────────────────────────────────────────
// Read-only usage summary for the Settings "Plan & Usage" dashboard. Always
// meaningful regardless of ENFORCE_QUOTAS — it reports real UsageCounter data,
// it just never blocks anything while the flag is off.
router.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await getUsageSummary(req.userId!);
    res.json(summary);
  } catch (err) {
    console.error('[GET /api/usage]', err);
    res.status(500).json({ error: 'Failed to load usage summary' });
  }
});

export default router;
