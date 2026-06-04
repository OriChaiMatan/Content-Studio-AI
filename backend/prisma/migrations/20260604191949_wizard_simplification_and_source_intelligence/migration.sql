-- CreateEnum
CREATE TYPE "ContentGoal" AS ENUM ('build_authority', 'generate_leads', 'increase_sales', 'educate_audience', 'grow_community', 'personal_branding', 'other');

-- CreateEnum
CREATE TYPE "ContentStyle" AS ENUM ('professional', 'authoritative', 'friendly', 'personal', 'journalistic', 'provocative', 'humorous', 'other');

-- AlterTable
ALTER TABLE "content_cases" ADD COLUMN     "contentGoal" "ContentGoal" NOT NULL DEFAULT 'build_authority',
ADD COLUMN     "contentStyle" "ContentStyle" NOT NULL DEFAULT 'professional',
ADD COLUMN     "contentTargets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "goalCustom" TEXT,
ADD COLUMN     "styleCustom" TEXT;

-- AlterTable
ALTER TABLE "content_sources" ADD COLUMN     "sourceIntelligence" JSONB;
