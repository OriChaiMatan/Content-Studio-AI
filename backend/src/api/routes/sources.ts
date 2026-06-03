import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { sourceService } from '../../services/sourceService';
import { addSourceSchema, updateSourceSchema } from '../../schemas/sourceSchemas';

const router = Router();

// ── POST /api/cases/:id/sources ───────────────────────────────────────────────
// Add a new source to an existing Content Case.
// Works for text notes, URL references, and PDF filename placeholders.

router.post('/:id/sources', async (req: Request, res: Response) => {
  try {
    const input  = addSourceSchema.parse(req.body);
    const source = await sourceService.addSource(req.params.id, input);

    if (!source) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    res.status(201).json(source);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/cases/:id/sources]', err);
    res.status(500).json({ error: 'Failed to add source' });
  }
});

// ── PATCH /api/cases/:id/sources/:sourceId ────────────────────────────────────
// Edit a source's label or content.
// Only text sources are editable in the UI, but the API accepts any type.

router.patch('/:id/sources/:sourceId', async (req: Request, res: Response) => {
  try {
    const input  = updateSourceSchema.parse(req.body);
    const source = await sourceService.updateSource(req.params.id, req.params.sourceId, input);

    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    res.json(source);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[PATCH /api/cases/:id/sources/:sourceId]', err);
    res.status(500).json({ error: 'Failed to update source' });
  }
});

// ── DELETE /api/cases/:id/sources/:sourceId ───────────────────────────────────
// Remove a source from a Content Case.

router.delete('/:id/sources/:sourceId', async (req: Request, res: Response) => {
  try {
    const deleted = await sourceService.deleteSource(req.params.id, req.params.sourceId);

    if (!deleted) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /api/cases/:id/sources/:sourceId]', err);
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

export default router;
