-- The AI layer moves from each agent to the workspace, where staff choose it.

-- AlterEnum
ALTER TYPE "VoiceEngine" ADD VALUE 'GEMINI_LIVE';

-- CreateTable
CREATE TABLE "WorkspaceAiSettings" (
    "workspaceId" TEXT NOT NULL,
    "voiceEngine" "VoiceEngine" NOT NULL,
    "llmProvider" "AiProvider" NOT NULL DEFAULT 'OPENAI',
    "model" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAiSettings_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "PlatformCredential" (
    "provider" "CredentialProvider" NOT NULL,
    "label" TEXT,
    "apiKeyEnc" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCredential_pkey" PRIMARY KEY ("provider")
);

-- AddForeignKey
ALTER TABLE "WorkspaceAiSettings" ADD CONSTRAINT "WorkspaceAiSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep existing workspaces on the engine and model their most recently edited agent used.
INSERT INTO "WorkspaceAiSettings" ("workspaceId", "voiceEngine", "llmProvider", "model", "updatedAt")
SELECT DISTINCT ON ("workspaceId") "workspaceId", "voiceEngine", "llmProvider", "llmModel", CURRENT_TIMESTAMP
FROM "Agent"
ORDER BY "workspaceId", "updatedAt" DESC;

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "llmModel",
DROP COLUMN "llmProvider",
DROP COLUMN "voiceEngine";
