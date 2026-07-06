import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { PodcastEpisode } from '@prisma/client';

// ── Summary shape returned by listForCase ────────────────────────────────────

export interface PodcastEpisodeSummary {
  id: string;
  pipelineRunId: string;
  version: number;
  status: string;
  title: string;
  subtitle: string;
  language: string;
  wordCount: number;
  estimatedDurationMin: number;
  researchDensity: string;
  qualityStatus: string | null;
  sectionsCompleted: number;
  approximateCostUsd: number | null;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

const SUMMARY_SELECT = {
  id: true,
  pipelineRunId: true,
  version: true,
  status: true,
  title: true,
  subtitle: true,
  language: true,
  wordCount: true,
  estimatedDurationMin: true,
  researchDensity: true,
  qualityStatus: true,
  sectionsCompleted: true,
  approximateCostUsd: true,
  startedAt: true,
  completedAt: true,
  errorMessage: true,
} as const satisfies Prisma.PodcastEpisodeSelect;

// ── Pure helper — exported for unit testing ───────────────────────────────────
// Builds the Prisma create-data for a new version of an episode.
// Copies researchPack (Stage 1) only — all downstream artifacts are absent,
// so the data-driven runner will start from Stage 2 (Blueprint).

export function buildNextVersionData(
  source: Pick<PodcastEpisode, 'contentCaseId' | 'pipelineRunId' | 'researchPack'>,
  nextVersion: number,
): Prisma.PodcastEpisodeUncheckedCreateInput {
  return {
    contentCaseId: source.contentCaseId,
    pipelineRunId: source.pipelineRunId,
    version: nextVersion,
    researchPack: source.researchPack ?? Prisma.JsonNull,
    // blueprint, sections, critique, podcastPackage — absent → null defaults in DB
    // status defaults to 'pending' via schema @default(pending)
  };
}

export const podcastEpisodeService = {
  async create(contentCaseId: string, pipelineRunId: string): Promise<PodcastEpisode> {
    return prisma.podcastEpisode.create({
      data: { contentCaseId, pipelineRunId },
    });
  },

  async findById(id: string): Promise<PodcastEpisode | null> {
    return prisma.podcastEpisode.findUnique({ where: { id } });
  },

  // Returns the most recent in-progress episode for this run (excludes terminal states).
  // Used to enforce "only one active generation per run" before starting or regenerating.
  async findActiveForRun(pipelineRunId: string): Promise<PodcastEpisode | null> {
    return prisma.podcastEpisode.findFirst({
      where: {
        pipelineRunId,
        status: { notIn: ['completed', 'failed'] },
      },
      orderBy: { startedAt: 'desc' },
    });
  },

  async listForCase(contentCaseId: string): Promise<PodcastEpisodeSummary[]> {
    return prisma.podcastEpisode.findMany({
      where: { contentCaseId },
      orderBy: { startedAt: 'desc' },
      select: SUMMARY_SELECT,
    });
  },

  // Creates a new version of the episode, copying only researchPack.
  // The max version across all episodes for this run is queried so concurrent
  // failed versions don't produce duplicate version numbers.
  async createNextVersion(source: PodcastEpisode): Promise<PodcastEpisode> {
    const agg = await prisma.podcastEpisode.aggregate({
      where: { pipelineRunId: source.pipelineRunId },
      _max: { version: true },
    });
    const nextVersion = (agg._max.version ?? 0) + 1;
    return prisma.podcastEpisode.create({
      data: buildNextVersionData(source, nextVersion),
    });
  },

  // Best-effort terminal failure mark — must not throw.
  async markFailed(id: string, reason: string): Promise<void> {
    await prisma.podcastEpisode.update({
      where: { id },
      data: { status: 'failed', errorMessage: reason },
    }).catch(err =>
      console.error('[podcastEpisodeService.markFailed]', id, err instanceof Error ? err.message : err),
    );
  },
};
