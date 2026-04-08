-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'telegram';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
