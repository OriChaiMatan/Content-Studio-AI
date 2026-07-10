-- CreateEnum
CREATE TYPE "CaseLifecycleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "content_cases" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleStatus" "CaseLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "currentUsagePeriodEnd" SET DEFAULT now() + interval '7 days',
ALTER COLUMN "nextUsageResetAt" SET DEFAULT now() + interval '7 days';

-- CreateIndex
CREATE INDEX "content_cases_userId_lifecycleStatus_idx" ON "content_cases"("userId", "lifecycleStatus");
