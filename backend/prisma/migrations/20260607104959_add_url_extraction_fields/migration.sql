-- AlterTable
ALTER TABLE "content_sources" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "extractedTitle" TEXT,
ADD COLUMN     "extractionError" TEXT,
ADD COLUMN     "extractionStatus" TEXT;
