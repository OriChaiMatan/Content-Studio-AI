-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'he');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('text', 'url', 'pdf');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('draft', 'research', 'fact_check', 'generating', 'in_review', 'completed');

-- CreateEnum
CREATE TYPE "OutputStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('manual', 'daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('beginner', 'intermediate', 'expert');

-- CreateEnum
CREATE TYPE "PipelineStepName" AS ENUM ('research', 'fact_check', 'content_creation');

-- CreateEnum
CREATE TYPE "PipelineStepStatus" AS ENUM ('idle', 'running', 'completed', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Editor',
    "avatarUrl" TEXT,
    "language" "Language" NOT NULL DEFAULT 'en',
    "notifGenerationComplete" BOOLEAN NOT NULL DEFAULT true,
    "notifFactCheckConflict" BOOLEAN NOT NULL DEFAULT true,
    "notifDraftReady" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'draft',
    "language" "Language" NOT NULL DEFAULT 'en',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'intermediate',
    "writingStyle" TEXT NOT NULL DEFAULT '',
    "goals" TEXT NOT NULL DEFAULT '',
    "aiInstructions" TEXT NOT NULL DEFAULT '',
    "scheduleFrequency" "ScheduleFrequency" NOT NULL DEFAULT 'manual',
    "scheduleTime" TEXT,
    "scheduleDayOfWeek" INTEGER,
    "scheduleDayOfMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_sources" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "content_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_outputs" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "pipelineRunId" TEXT,
    "platform" "Platform" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutputStatus" NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT 'v1.0.0',
    "contentScore" INTEGER,
    "researchConfidence" INTEGER,
    "factCheckAccuracy" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "content_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_steps" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "name" "PipelineStepName" NOT NULL,
    "status" "PipelineStepStatus" NOT NULL DEFAULT 'idle',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "confidence" INTEGER,

    CONSTRAINT "pipeline_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_jobs" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "stepName" "PipelineStepName" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "queueJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_items" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "outputId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutputStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "content_cases_userId_status_idx" ON "content_cases"("userId", "status");

-- CreateIndex
CREATE INDEX "content_cases_updatedAt_idx" ON "content_cases"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "content_sources_contentCaseId_createdAt_idx" ON "content_sources"("contentCaseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "content_outputs_contentCaseId_platform_idx" ON "content_outputs"("contentCaseId", "platform");

-- CreateIndex
CREATE INDEX "content_outputs_contentCaseId_status_idx" ON "content_outputs"("contentCaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_steps_contentCaseId_name_key" ON "pipeline_steps"("contentCaseId", "name");

-- CreateIndex
CREATE INDEX "pipeline_runs_contentCaseId_startedAt_idx" ON "pipeline_runs"("contentCaseId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "pipeline_jobs_pipelineRunId_stepName_idx" ON "pipeline_jobs"("pipelineRunId", "stepName");

-- CreateIndex
CREATE UNIQUE INDEX "library_items_outputId_key" ON "library_items"("outputId");

-- CreateIndex
CREATE INDEX "library_items_contentCaseId_idx" ON "library_items"("contentCaseId");

-- CreateIndex
CREATE INDEX "library_items_platform_status_idx" ON "library_items"("platform", "status");

-- AddForeignKey
ALTER TABLE "content_cases" ADD CONSTRAINT "content_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "content_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "content_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
