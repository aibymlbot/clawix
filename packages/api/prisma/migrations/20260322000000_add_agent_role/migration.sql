-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('primary', 'worker');

-- AlterTable
ALTER TABLE "AgentDefinition" ADD COLUMN "role" "AgentRole" NOT NULL DEFAULT 'primary';

-- CreateIndex
CREATE INDEX "AgentDefinition_role_isActive_idx" ON "AgentDefinition"("role", "isActive");
