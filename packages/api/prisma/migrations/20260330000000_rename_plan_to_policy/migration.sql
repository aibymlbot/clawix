-- RenameTable: Plan → Policy
ALTER TABLE "Plan" RENAME TO "Policy";

-- RenameColumn: User.planId → User.policyId
ALTER TABLE "User" RENAME COLUMN "planId" TO "policyId";

-- Rename the foreign key constraint
ALTER TABLE "User" RENAME CONSTRAINT "User_planId_fkey" TO "User_policyId_fkey";

-- Rename the unique index on Policy.name (Prisma convention)
ALTER INDEX "Plan_name_key" RENAME TO "Policy_name_key";

-- Rename the primary key index
ALTER INDEX "Plan_pkey" RENAME TO "Policy_pkey";
