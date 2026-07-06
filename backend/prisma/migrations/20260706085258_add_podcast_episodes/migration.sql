-- CreateEnum
CREATE TYPE "PodcastEpisodeStatus" AS ENUM ('pending', 'generating', 'pack_ready', 'blueprint_ready', 'critique_ready', 'completed', 'failed');

-- CreateTable
CREATE TABLE "podcast_episodes" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "status" "PodcastEpisodeStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "researchPack" JSONB,
    "blueprint" JSONB,
    "sections" JSONB,
    "sectionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "critique" JSONB,
    "podcastPackage" JSONB,
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'en',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedDurationMin" INTEGER NOT NULL DEFAULT 0,
    "researchDensity" TEXT NOT NULL DEFAULT 'limited',
    "qualityStatus" TEXT,
    "approximateCostUsd" DOUBLE PRECISION,
    "telemetry" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "podcast_episodes_contentCaseId_startedAt_idx" ON "podcast_episodes"("contentCaseId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "podcast_episodes_pipelineRunId_startedAt_idx" ON "podcast_episodes"("pipelineRunId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
