/*
  Warnings:

  - You are about to drop the `Skill` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkillApproval` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_createdById_fkey";

-- DropForeignKey
ALTER TABLE "SkillApproval" DROP CONSTRAINT "SkillApproval_skillId_fkey";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "SkillApproval";

-- DropEnum
DROP TYPE "SkillApprovalStatus";
