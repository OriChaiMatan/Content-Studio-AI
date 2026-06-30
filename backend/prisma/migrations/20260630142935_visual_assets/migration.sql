-- CreateEnum
CREATE TYPE "VisualStatus" AS ENUM ('pending', 'generating', 'rendering', 'ready', 'failed');

-- CreateTable
CREATE TABLE "visual_assets" (
    "id" TEXT NOT NULL,
    "contentOutputId" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "platform" "Platform" NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'en',
    "status" "VisualStatus" NOT NULL DEFAULT 'pending',
    "visualCategory" TEXT,
    "visualIntent" TEXT,
    "backgroundPrompt" TEXT,
    "overlaySpec" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "backgroundKey" TEXT,
    "finalKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visual_assets_contentOutputId_version_idx" ON "visual_assets"("contentOutputId", "version" DESC);

-- AddForeignKey
ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_contentOutputId_fkey" FOREIGN KEY ("contentOutputId") REFERENCES "content_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
