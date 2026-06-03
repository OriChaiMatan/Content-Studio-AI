-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('new', 'used', 'ignored', 'error');

-- AlterTable
ALTER TABLE "content_sources" ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "status" "SourceStatus" NOT NULL DEFAULT 'new',
ADD COLUMN     "usedInRunId" TEXT;

-- AlterTable
ALTER TABLE "pipeline_runs" ADD COLUMN     "contextSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primarySourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "status" SET DEFAULT 'running';

-- CreateIndex
CREATE INDEX "content_sources_contentCaseId_status_idx" ON "content_sources"("contentCaseId", "status");
