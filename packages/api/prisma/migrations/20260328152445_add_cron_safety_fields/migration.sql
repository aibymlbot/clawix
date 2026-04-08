-- DropIndex
DROP INDEX "Task_enabled_idx";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "cronEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxScheduledTasks" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "maxTokensPerCronRun" INTEGER,
ADD COLUMN     "minCronIntervalSecs" INTEGER NOT NULL DEFAULT 300;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "disabledReason" TEXT,
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "timeoutMs" INTEGER;

-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "durationMs" INTEGER;

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_enabled_nextRunAt_idx" ON "Task"("enabled", "nextRunAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
