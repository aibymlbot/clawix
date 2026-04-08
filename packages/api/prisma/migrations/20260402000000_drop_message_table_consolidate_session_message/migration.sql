-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_channelId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_sessionId_fkey";

-- AlterTable
ALTER TABLE "SessionMessage" ADD COLUMN     "senderId" TEXT;

-- DropTable
DROP TABLE "Message";

-- DropEnum
DROP TYPE "MessageDirection";
