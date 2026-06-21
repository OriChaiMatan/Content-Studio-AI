-- AlterTable
ALTER TABLE "whatsapp_pending_sources" ADD COLUMN     "caseId" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'select_case',
ADD COLUMN     "sourceId" TEXT;
