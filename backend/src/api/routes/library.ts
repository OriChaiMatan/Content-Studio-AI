import { Router } from 'express';
import type { Request, Response } from 'express';
import { libraryService } from '../../services/libraryService';

const router = Router();

// ── GET /api/library ──────────────────────────────────────────────────────────
// Returns approved Library items grouped by Pipeline Run.
// Each group includes run metadata and the individual items.
// Sorted newest run first.

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await libraryService.getGrouped(req.userId!);
    res.json(data);
  } catch (err) {
    console.error('[GET /api/library]', err);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

export default router;
