-- AlterTable
ALTER TABLE "podcast_episodes" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "podcast_episodes_pipelineRunId_version_idx" ON "podcast_episodes"("pipelineRunId", "version" DESC);
