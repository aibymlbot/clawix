/*
  Warnings:

  - Added the required column `displayName` to the `ProviderConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProviderConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add columns with temporary defaults to handle existing rows
ALTER TABLE "ProviderConfig"
ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "isEnabled"   BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sortOrder"   INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill displayName from provider for existing rows
UPDATE "ProviderConfig" SET "displayName" = "provider" WHERE "displayName" = '';

-- Remove the temporary default from displayName (Prisma schema has no @default)
ALTER TABLE "ProviderConfig" ALTER COLUMN "displayName" DROP DEFAULT;

-- Remove the temporary default from updatedAt (Prisma schema uses @updatedAt, not @default)
ALTER TABLE "ProviderConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
