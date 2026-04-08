-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "parent_agent_run_id" TEXT;

-- CreateIndex
CREATE INDEX "AgentRun_parent_agent_run_id_idx" ON "AgentRun"("parent_agent_run_id");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_parent_agent_run_id_fkey" FOREIGN KEY ("parent_agent_run_id") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
