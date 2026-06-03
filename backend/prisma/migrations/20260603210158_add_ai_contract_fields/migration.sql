-- AlterTable
ALTER TABLE "pipeline_runs" ADD COLUMN     "contentPackage" JSONB,
ADD COLUMN     "factCheckReport" JSONB,
ADD COLUMN     "researchContext" JSONB;
