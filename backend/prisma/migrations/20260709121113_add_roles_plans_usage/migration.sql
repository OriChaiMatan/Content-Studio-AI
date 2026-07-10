-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'MASTER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('PIPELINE_RUN', 'SOURCE_ADDED', 'IMAGE_GENERATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentUsagePeriodEnd" TIMESTAMP(3) NOT NULL DEFAULT now() + interval '7 days',
ADD COLUMN     "currentUsagePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "nextUsageResetAt" TIMESTAMP(3) NOT NULL DEFAULT now() + interval '7 days',
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "planStatus" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "systemRole" "SystemRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentCaseId" TEXT,
    "metric" "UsageMetric" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_counters_userId_metric_idx" ON "usage_counters"("userId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_userId_contentCaseId_metric_key" ON "usage_counters"("userId", "contentCaseId", "metric");

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
