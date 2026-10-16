-- CreateEnum
CREATE TYPE "NoiseFilter" AS ENUM ('OFF', 'STANDARD', 'STRONG');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "callbackGreeting" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "callbackInstructions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inboundGreeting" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inboundInstructions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "noiseFilter" "NoiseFilter" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "isCallback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placedById" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "callDelaySeconds" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

