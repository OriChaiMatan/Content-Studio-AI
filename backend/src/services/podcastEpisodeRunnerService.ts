import { prisma } from '../lib/prisma';
import { buildResearchPack } from './podcast-spike/researchPackService';
import { buildBlueprint } from './podcast-spike/podcastBlueprintService';
import { generateSingleSection } from './podcast-spike/podcastScriptService';
import { runCritic } from './podcast-spike/podcastCriticService';
import { buildPackage } from './podcast-spike/podcastPackageService';
import type { ResearchContextV2, FactCheckReport } from '../schemas/aiContractSchemas';
import type {
  ResearchPack, Blueprint, EpisodeSection, CriticReport, StageTelemetry,
} from './podcast-spike/podcastSpikeTypes';

// ── Cost constants (claude-sonnet-4-6, July 2026) ────────────────────────────

const COST_PER_1M_INPUT       = 3.0;
const COST_PER_1M_OUTPUT      = 15.0;
const COST_PER_1M_CACHE_READ  = 0.30;
const COST_PER_1M_CACHE_WRITE = 3.75;

function computeCost(stages: StageTelemetry[]): number {
  let c = 0;
  for (const s of stages) {
    c += (s.inputTokens / 1_000_000) * COST_PER_1M_INPUT;
    c += (s.outputTokens / 1_000_000) * COST_PER_1M_OUTPUT;
    c += (s.cacheReadInputTokens / 1_000_000) * COST_PER_1M_CACHE_READ;
    c += (s.cacheCreationInputTokens / 1_000_000) * COST_PER_1M_CACHE_WRITE;
  }
  return Math.round(c * 10000) / 10000;
}

// ── Runner ────────────────────────────────────────────────────────────────────
//
// Drives a PodcastEpisode row through all 5 stages with section-level
// resumability. Each stage persists its artifact before moving to the next so
// a crash can restart from the last completed stage at no extra cost.
//
// Status transitions:
//   pending → generating → pack_ready → blueprint_ready
//   → (sections generate; sectionsCompleted increments after each)
//   → critique_ready → completed
//   Any stage failure → failed (errorMessage set)
//
// Safe to call on a partially-completed episode: data-driven resume checks
// which JSON fields are null and skips already-completed stages.

export async function runPodcastEpisode(episodeId: string): Promise<void> {
  const stageTelemetry: StageTelemetry[] = [];

  try {
    // ── Load episode + artifacts ─────────────────────────────────────────────
    const row = await prisma.podcastEpisode.findUniqueOrThrow({
      where: { id: episodeId },
      include: {
        pipelineRun: {
          select: { id: true, researchContext: true, factCheckReport: true },
        },
        contentCase: {
          select: { targetAudience: true },
        },
      },
    });

    if (row.status === 'completed') {
      console.log(`[podcast-engine:${episodeId}] already completed — skipping`);
      return;
    }

    if (!row.pipelineRun.researchContext || !row.pipelineRun.factCheckReport) {
      throw new Error(`Pipeline run ${row.pipelineRun.id} is missing researchContext or factCheckReport`);
    }

    const rc  = row.pipelineRun.researchContext as unknown as ResearchContextV2;
    const fcr = row.pipelineRun.factCheckReport as unknown as FactCheckReport;
    const audience = row.contentCase.targetAudience ?? '';

    // Mark as actively generating before touching any stage
    await prisma.podcastEpisode.update({
      where: { id: episodeId },
      data: { status: 'generating' },
    });

    // ── Stage 1: Research Pack ────────────────────────────────────────────────
    let pack = row.researchPack as unknown as ResearchPack | null;

    if (!pack) {
      console.log(`[podcast-engine:${episodeId}] Stage 1: Research Pack`);
      pack = await buildResearchPack(rc, fcr, audience, stageTelemetry);
      await prisma.podcastEpisode.update({
        where: { id: episodeId },
        data: {
          status: 'pack_ready',
          researchPack: pack as object,
          language: pack.language,
          researchDensity: pack.researchDensity,
        },
      });
    }

    // ── Stage 2: Blueprint ────────────────────────────────────────────────────
    let blueprint = row.blueprint as unknown as Blueprint | null;

    if (!blueprint) {
      console.log(`[podcast-engine:${episodeId}] Stage 2: Blueprint`);
      blueprint = await buildBlueprint(pack, stageTelemetry);
      await prisma.podcastEpisode.update({
        where: { id: episodeId },
        data: {
          status: 'blueprint_ready',
          blueprint: blueprint as object,
          title: blueprint.title,
          subtitle: blueprint.subtitle,
        },
      });
    }

    // ── Stage 3: Sections (section-level resumability) ────────────────────────
    // existingSections holds everything completed so far (from DB or this run).
    // On crash mid-sections the DB has the partial array; we resume from length.
    const existingSections: EpisodeSection[] =
      (row.sections as unknown as EpisodeSection[] | null) ?? [];
    const totalSections = blueprint.sections.length;

    for (let i = existingSections.length; i < totalSections; i++) {
      console.log(
        `[podcast-engine:${episodeId}] Stage 3: section ${i + 1}/${totalSections} "${blueprint.sections[i].name}"`,
      );
      const section = await generateSingleSection(pack, blueprint, i, existingSections, stageTelemetry);
      existingSections.push(section);

      await prisma.podcastEpisode.update({
        where: { id: episodeId },
        data: {
          sections: existingSections as object[],
          sectionsCompleted: existingSections.length,
        },
      });
    }

    // ── Stage 4: Critic ────────────────────────────────────────────────────────
    let critique = row.critique as unknown as CriticReport | null;

    if (!critique) {
      console.log(`[podcast-engine:${episodeId}] Stage 4: Critic`);
      critique = await runCritic(pack, blueprint, existingSections, stageTelemetry);
      const totalWords = existingSections.reduce((sum, s) => sum + s.wordCount, 0);
      const wpm = pack.language === 'he' ? 130 : 150;

      await prisma.podcastEpisode.update({
        where: { id: episodeId },
        data: {
          status: 'critique_ready',
          critique: critique as object,
          qualityStatus: critique.qualityStatus ?? null,
          wordCount: totalWords,
          estimatedDurationMin: Math.round(totalWords / wpm),
        },
      });
    }

    // ── Stage 5: Package ───────────────────────────────────────────────────────
    console.log(`[podcast-engine:${episodeId}] Stage 5: Package`);
    const pkg = await buildPackage(pack, blueprint, existingSections, stageTelemetry);
    const cost = computeCost(stageTelemetry);

    await prisma.podcastEpisode.update({
      where: { id: episodeId },
      data: {
        status: 'completed',
        podcastPackage: pkg as object,
        telemetry: stageTelemetry as object[],
        approximateCostUsd: cost,
        completedAt: new Date(),
      },
    });

    console.log(`[podcast-engine:${episodeId}] Complete — $${cost.toFixed(4)}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[podcast-engine:${episodeId}] Failed:`, message);
    await prisma.podcastEpisode.update({
      where: { id: episodeId },
      data: { status: 'failed', errorMessage: message },
    }).catch(() => { /* best-effort: don't mask original error */ });
    throw err;
  }
}

// ── Service object ─────────────────────────────────────────────────────────────
// Wraps the runner in a never-throw shell for detached invocation from routes.

export const podcastEpisodeRunnerService = {
  async runDetached(episodeId: string): Promise<void> {
    void runPodcastEpisode(episodeId).catch(err =>
      console.error(
        '[podcastEpisodeRunnerService] uncaught error for episode',
        episodeId,
        err instanceof Error ? err.message : err,
      ),
    );
  },
};
