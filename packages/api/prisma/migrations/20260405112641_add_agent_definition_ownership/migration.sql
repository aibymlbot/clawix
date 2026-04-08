-- AlterTable
ALTER TABLE "AgentDefinition" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "AgentDefinition_createdById_idx" ON "AgentDefinition"("createdById");

-- AddForeignKey
ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
