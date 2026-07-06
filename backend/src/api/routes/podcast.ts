import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireCaseOwnership } from '../middleware/auth';
import { aiHeavyLimiter } from '../middleware/rateLimit';
import { podcastEpisodeService } from '../../services/podcastEpisodeService';
import { podcastEpisodeRunnerService } from '../../services/podcastEpisodeRunnerService';

const router = Router();

// All routes are scoped to a contentCase. requireCaseOwnership fires on ':caseId'
// and returns 404 if the case belongs to a different user — same pattern as all
// other case-scoped routers.
router.param('caseId', requireCaseOwnership);

// ── GET /api/cases/:caseId/podcast/episodes ───────────────────────────────────
// List all podcast episodes for this case (summaries, no full JSON blobs).

router.get('/:caseId/podcast/episodes', async (req: Request, res: Response) => {
  try {
    const episodes = await podcastEpisodeService.listForCase(req.params.caseId);
    res.json({ episodes });
  } catch (err) {
    console.error('[GET /podcast/episodes]', err);
    res.status(500).json({ error: 'Failed to list podcast episodes' });
  }
});

// ── POST /api/cases/:caseId/podcast/episodes ──────────────────────────────────
// Trigger podcast generation from a completed pipeline run.
//
// Body: { pipelineRunId: string }
//
// Pre-flight:
//   • pipeline run must belong to this case
//   • pipeline run must have researchContext + factCheckReport
//   • if an episode for this run is already generating (not failed/completed), 409
//
// Returns 202 immediately; generation runs detached in-process.

router.post('/:caseId/podcast/episodes', aiHeavyLimiter, async (req: Request, res: Response) => {
  const { caseId } = req.params;
  const { pipelineRunId } = req.body as { pipelineRunId?: string };

  if (!pipelineRunId || typeof pipelineRunId !== 'string') {
    res.status(400).json({ error: 'pipelineRunId is required' });
    return;
  }

  try {
    // Verify the run belongs to this case and has the required artifacts
    const run = await prisma.pipelineRun.findUnique({
      where: { id: pipelineRunId, contentCaseId: caseId },
      select: { id: true, researchContext: true, factCheckReport: true },
    });

    if (!run) {
      res.status(404).json({ error: 'run_not_found' });
      return;
    }
    if (!run.researchContext || !run.factCheckReport) {
      res.status(400).json({ error: 'missing_pipeline_artifacts' });
      return;
    }

    // Reject if an active (non-terminal) episode already exists for this run
    const active = await podcastEpisodeService.findActiveForRun(pipelineRunId);
    if (active) {
      if (active.status === 'completed') {
        res.status(200).json({ episodeId: active.id, status: active.status });
        return;
      }
      // Currently generating — tell the client to poll
      res.status(409).json({ error: 'already_generating', episodeId: active.id });
      return;
    }

    // Create episode row and detach runner
    const episode = await podcastEpisodeService.create(caseId, pipelineRunId);
    await podcastEpisodeRunnerService.runDetached(episode.id);

    res.status(202).json({ accepted: true, episodeId: episode.id, status: 'pending' });
  } catch (err) {
    console.error('[POST /podcast/episodes]', err);
    res.status(500).json({ error: 'Failed to start podcast generation' });
  }
});

// ── GET /api/cases/:caseId/podcast/episodes/:episodeId ───────────────────────
// Get a single episode. Returns full row (including all Json blobs) so the
// frontend can render the review UI once status === 'completed'.

router.get('/:caseId/podcast/episodes/:episodeId', async (req: Request, res: Response) => {
  try {
    const episode = await podcastEpisodeService.findById(req.params.episodeId);

    if (!episode || episode.contentCaseId !== req.params.caseId) {
      res.status(404).json({ error: 'episode_not_found' });
      return;
    }

    res.json(episode);
  } catch (err) {
    console.error('[GET /podcast/episodes/:id]', err);
    res.status(500).json({ error: 'Failed to get podcast episode' });
  }
});

// ── POST /api/cases/:caseId/podcast/episodes/:episodeId/regenerate ────────────
// Create a new version of a completed or failed episode. Copies researchPack
// (Stage 1) so the runner starts from Stage 2 (Blueprint) rather than scratch.
// The old episode row is preserved untouched.
//
// Returns 409 if the episode or any sibling version is still generating.

router.post(
  '/:caseId/podcast/episodes/:episodeId/regenerate',
  aiHeavyLimiter,
  async (req: Request, res: Response) => {
    try {
      const episode = await podcastEpisodeService.findById(req.params.episodeId);

      if (!episode || episode.contentCaseId !== req.params.caseId) {
        res.status(404).json({ error: 'episode_not_found' });
        return;
      }

      // Must be in a terminal state to regenerate
      if (!['completed', 'failed'].includes(episode.status)) {
        res.status(409).json({ error: 'already_generating', episodeId: episode.id, status: episode.status });
        return;
      }

      // Block if any other version of this run is currently in-progress
      const active = await podcastEpisodeService.findActiveForRun(episode.pipelineRunId);
      if (active) {
        res.status(409).json({ error: 'another_version_generating', episodeId: active.id, status: active.status });
        return;
      }

      // Create new version row (researchPack copied, all downstream artifacts absent)
      const newEpisode = await podcastEpisodeService.createNextVersion(episode);
      await podcastEpisodeRunnerService.runDetached(newEpisode.id);

      res.status(202).json({ accepted: true, episodeId: newEpisode.id, version: newEpisode.version, status: 'pending' });
    } catch (err) {
      console.error('[POST /podcast/episodes/:id/regenerate]', err);
      res.status(500).json({ error: 'Failed to regenerate podcast episode' });
    }
  },
);

export default router;
