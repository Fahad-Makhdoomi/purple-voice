-- Free plan, campaign retry options, agent email/WhatsApp tools, page builder,
-- advanced blog SEO, redirects, cookie-consent records and terms acceptance.

-- CreateEnum
CREATE TYPE "DialResult" AS ENUM ('REACHED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL', 'FAILED', 'SILENT');

-- CreateEnum
CREATE TYPE "RetryStrategy" AS ENUM ('END_OF_LIST', 'AFTER_DELAY', 'NEXT_DAY');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'SMTP';
ALTER TYPE "IntegrationType" ADD VALUE 'WHATSAPP';

-- AlterEnum
ALTER TYPE "PlanCode" ADD VALUE 'FREE' BEFORE 'BASIC';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareInfo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "consentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "retryOn" "DialResult"[] DEFAULT ARRAY['NO_ANSWER', 'BUSY', 'VOICEMAIL', 'SILENT', 'FAILED']::"DialResult"[],
ADD COLUMN     "retryStrategy" "RetryStrategy" NOT NULL DEFAULT 'END_OF_LIST',
ADD COLUMN     "retryWindowEnd" TEXT,
ADD COLUMN     "retryWindowStart" TEXT;

-- AlterTable
ALTER TABLE "CampaignContact" ADD COLUMN     "lastResult" "DialResult";

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "blocks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'markdown',
ADD COLUMN     "navLabel" TEXT,
ADD COLUMN     "navOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "showInHeader" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "authorBio" TEXT,
ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "faq" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "focusKeyword" TEXT,
ADD COLUMN     "howToSteps" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "nofollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ogDescription" TEXT,
ADD COLUMN     "ogTitle" TEXT,
ADD COLUMN     "schemaType" TEXT NOT NULL DEFAULT 'BlogPosting',
ADD COLUMN     "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "showToc" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- CreateTable
CREATE TABLE "CallMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT,
    "agentId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "analytics" BOOLEAN NOT NULL,
    "marketing" BOOLEAN NOT NULL,
    "preferences" BOOLEAN NOT NULL,
    "gpc" BOOLEAN NOT NULL DEFAULT false,
    "policyVersion" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallMessage_workspaceId_createdAt_idx" ON "CallMessage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CallMessage_callId_idx" ON "CallMessage"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_fromPath_key" ON "Redirect"("fromPath");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentId_idx" ON "ConsentRecord"("consentId");

-- CreateIndex
CREATE INDEX "ConsentRecord_createdAt_idx" ON "ConsentRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing contacts: what their last call amounted to.
UPDATE "CampaignContact" SET "lastResult" = 'REACHED' WHERE status = 'COMPLETED';
UPDATE "CampaignContact" SET "lastResult" = 'VOICEMAIL' WHERE status = 'NO_ANSWER' AND "lastOutcome" = 'VOICEMAIL';
UPDATE "CampaignContact" SET "lastResult" = 'NO_ANSWER' WHERE status = 'NO_ANSWER' AND "lastResult" IS NULL;
UPDATE "CampaignContact" SET "lastResult" = 'FAILED' WHERE status = 'FAILED';
UPDATE "CampaignContact" SET "lastResult" = 'NO_ANSWER' WHERE status = 'PENDING' AND attempts > 0;
