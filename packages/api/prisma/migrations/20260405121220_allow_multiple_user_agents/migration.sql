/*
  Warnings:

  - A unique constraint covering the columns `[userId,agentDefinitionId]` on the table `UserAgent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserAgent_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserAgent_userId_agentDefinitionId_key" ON "UserAgent"("userId", "agentDefinitionId");
