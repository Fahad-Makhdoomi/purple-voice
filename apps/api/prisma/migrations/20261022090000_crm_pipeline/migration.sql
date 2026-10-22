-- CRM (Pro and up): lead pipeline stages, leads, their timeline and per-workspace settings.
-- Calls remember the lead they were made to and who asked an agent to make them.

-- CreateEnum
CREATE TYPE "CrmStageKind" AS ENUM ('OPEN', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "requestedById" TEXT;

-- CreateTable
CREATE TABLE "CrmStage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "kind" "CrmStageKind" NOT NULL DEFAULT 'OPEN',
    "color" TEXT NOT NULL DEFAULT 'slate',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "company" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "valueCents" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fields" JSONB,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "campaignId" TEXT,
    "ownerId" TEXT,
    "lastOutcome" "CallOutcome",
    "lastCallAt" TIMESTAMP(3),
    "callDueAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "callId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSettings" (
    "workspaceId" TEXT NOT NULL,
    "hookToken" TEXT NOT NULL,
    "autoAddOutcomes" "CallOutcome"[] DEFAULT ARRAY['INTERESTED', 'APPOINTMENT_BOOKED', 'CALLBACK_REQUESTED']::"CallOutcome"[],
    "autoAddInbound" BOOLEAN NOT NULL DEFAULT true,
    "instantCallEnabled" BOOLEAN NOT NULL DEFAULT false,
    "instantAgentId" TEXT,
    "instantNumberId" TEXT,
    "instantWindowStart" TEXT,
    "instantWindowEnd" TEXT,
    "whatsappLeads" BOOLEAN NOT NULL DEFAULT true,
    "whatsappReply" TEXT NOT NULL DEFAULT '',
    "metaAppSecretEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSettings_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE INDEX "CrmStage_workspaceId_position_idx" ON "CrmStage"("workspaceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CrmStage_workspaceId_key_key" ON "CrmStage"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "CrmLead_workspaceId_stageId_idx" ON "CrmLead"("workspaceId", "stageId");

-- CreateIndex
CREATE INDEX "CrmLead_callDueAt_idx" ON "CrmLead"("callDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmLead_workspaceId_phone_key" ON "CrmLead"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX "CrmActivity_leadId_createdAt_idx" ON "CrmActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSettings_hookToken_key" ON "CrmSettings"("hookToken");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmStage" ADD CONSTRAINT "CrmStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CrmStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSettings" ADD CONSTRAINT "CrmSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The CRM is a Pro feature: Pro and Enterprise get it, the other plans don't.
UPDATE "Plan" SET "features" = "features" || '{"crm": true}'::jsonb WHERE "code" IN ('PRO', 'ENTERPRISE');
UPDATE "Plan" SET "features" = "features" || '{"crm": false}'::jsonb WHERE "code" NOT IN ('PRO', 'ENTERPRISE');
UPDATE "Plan" SET "highlights" = array_append("highlights", 'CRM with lead pipeline')
WHERE "code" = 'PRO' AND NOT ('CRM with lead pipeline' = ANY("highlights"));
