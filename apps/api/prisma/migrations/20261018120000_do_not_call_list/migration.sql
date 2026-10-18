-- A workspace-wide do-not-call list that every campaign checks before dialling.

-- CreateTable
CREATE TABLE "DoNotCallNumber" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotCallNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoNotCallNumber_workspaceId_phone_key" ON "DoNotCallNumber"("workspaceId", "phone");

-- AddForeignKey
ALTER TABLE "DoNotCallNumber" ADD CONSTRAINT "DoNotCallNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- People who already asked not to be called, in any campaign.
INSERT INTO "DoNotCallNumber" ("id", "workspaceId", "phone", "source", "createdAt")
SELECT gen_random_uuid()::text, "workspaceId", "phone", 'call', now()
FROM "CampaignContact"
WHERE "status" = 'DO_NOT_CALL'
GROUP BY "workspaceId", "phone"
ON CONFLICT DO NOTHING;
