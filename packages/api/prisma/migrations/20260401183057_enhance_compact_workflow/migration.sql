-- AlterTable
ALTER TABLE "SessionMessage" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SessionMessage_sessionId_archivedAt_idx" ON "SessionMessage"("sessionId", "archivedAt");
