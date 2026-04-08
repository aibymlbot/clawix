/*
  Warnings:

  - You are about to drop the `OrgSettings` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `SystemSettings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Clawix',
ADD COLUMN     "slug" TEXT NOT NULL DEFAULT 'clawix';

-- DropTable
DROP TABLE "OrgSettings";

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_slug_key" ON "SystemSettings"("slug");
