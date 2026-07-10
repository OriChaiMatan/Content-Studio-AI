-- usage_counters is brand new and empty (Phase 1, not yet consumed), so this
-- column can be added NOT NULL with no backfill and the old unique index
-- dropped/replaced safely.

-- AlterTable
ALTER TABLE "usage_counters" ADD COLUMN "scopeKey" TEXT NOT NULL;

-- DropIndex
DROP INDEX "usage_counters_userId_contentCaseId_metric_key";

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_userId_scopeKey_metric_key" ON "usage_counters"("userId", "scopeKey", "metric");
