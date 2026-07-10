import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireCaseOwnership, requireActiveCase } from '../middleware/auth';
import { imageGenLimiter } from '../middleware/rateLimit';
import { visualAssetService } from '../../services/visual/visualAssetService';
import { visualStorage } from '../../lib/visualStorage';
import { prisma } from '../../lib/prisma';
import { isQuotaError, sendQuotaError } from '../../lib/quotaErrors';

const router = Router();

// STRICT ownership: every visual route hangs off :caseId; non-owners get 404.
router.param('caseId', requireCaseOwnership);

// Visuals are only offered for these platforms in MVP.
const SUPPORTED = new Set(['linkedin', 'facebook']);

function platformFrom(req: Request): 'linkedin' | 'facebook' | null {
  const p = (req.body?.platform ?? req.query?.platform) as string | undefined;
  return p && SUPPORTED.has(p) ? (p as 'linkedin' | 'facebook') : null;
}

// Confirm the output belongs to this (already-owned) case — guards cross-case IDs.
async function outputInCase(caseId: string, outputId: string): Promise<boolean> {
  const o = await prisma.contentOutput.findFirst({ where: { id: outputId, contentCaseId: caseId }, select: { id: true } });
  return !!o;
}

// POST /api/cases/:caseId/outputs/:outputId/visual  — start (or return in-flight) generation.
router.post('/:caseId/outputs/:outputId/visual', requireActiveCase, imageGenLimiter, async (req: Request, res: Response) => {
  try {
    const platform = platformFrom(req);
    if (!platform) { res.status(400).json({ error: 'Unsupported platform (linkedin or facebook).' }); return; }
    if (!(await outputInCase(req.params.caseId, req.params.outputId))) { res.status(404).json({ error: 'Output not found' }); return; }
    const asset = await visualAssetService.start(req.params.caseId, req.params.outputId, platform);
    res.status(202).json(visualAssetService.serializeVisualAsset(asset));
  } catch (err) {
    if (isQuotaError(err)) { sendQuotaError(res, err); return; }
    console.error('[POST visual]', err);
    res.status(500).json({ error: 'Failed to start visual generation' });
  }
});

// GET /api/cases/:caseId/outputs/:outputId/visual?platform=  — latest asset (poll).
router.get('/:caseId/outputs/:outputId/visual', async (req: Request, res: Response) => {
  try {
    const platform = platformFrom(req);
    if (!platform) { res.status(400).json({ error: 'Unsupported platform (linkedin or facebook).' }); return; }
    if (!(await outputInCase(req.params.caseId, req.params.outputId))) { res.status(404).json({ error: 'Output not found' }); return; }
    const asset = await visualAssetService.getLatest(req.params.outputId, platform);
    res.json(asset ? visualAssetService.serializeVisualAsset(asset) : { status: 'idle', platform, finalUrl: null });
  } catch (err) {
    console.error('[GET visual]', err);
    res.status(500).json({ error: 'Failed to load visual' });
  }
});

// POST .../visual/regenerate — new version (reuses the concept, rerolls the image).
router.post('/:caseId/outputs/:outputId/visual/regenerate', requireActiveCase, imageGenLimiter, async (req: Request, res: Response) => {
  try {
    const platform = platformFrom(req);
    if (!platform) { res.status(400).json({ error: 'Unsupported platform (linkedin or facebook).' }); return; }
    if (!(await outputInCase(req.params.caseId, req.params.outputId))) { res.status(404).json({ error: 'Output not found' }); return; }
    const asset = await visualAssetService.regenerate(req.params.caseId, req.params.outputId, platform);
    res.status(202).json(visualAssetService.serializeVisualAsset(asset));
  } catch (err) {
    if (isQuotaError(err)) { sendQuotaError(res, err); return; }
    console.error('[POST visual/regenerate]', err);
    res.status(500).json({ error: 'Failed to regenerate visual' });
  }
});

// GET .../visual/:assetId/image — ownership-checked stream of the final PNG.
router.get('/:caseId/outputs/:outputId/visual/:assetId/image', async (req: Request, res: Response) => {
  try {
    const asset = await visualAssetService.getById(req.params.assetId);
    if (!asset || asset.contentCaseId !== req.params.caseId || asset.contentOutputId !== req.params.outputId || !asset.finalKey) {
      res.status(404).json({ error: 'Visual not found' });
      return;
    }
    res.type('image/png').sendFile(visualStorage.pathFor(asset.finalKey), err => { if (err && !res.headersSent) res.status(404).json({ error: 'Visual file missing' }); });
  } catch (err) {
    console.error('[GET visual image]', err);
    res.status(500).json({ error: 'Failed to load visual image' });
  }
});

export default router;
