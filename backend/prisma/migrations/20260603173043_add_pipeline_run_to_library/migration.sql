-- AlterTable
ALTER TABLE "library_items" ADD COLUMN     "pipelineRunId" TEXT;

-- CreateIndex
CREATE INDEX "library_items_pipelineRunId_idx" ON "library_items"("pipelineRunId");

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
