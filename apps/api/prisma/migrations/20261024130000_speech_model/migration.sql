-- Staff choose the text-to-speech model (Bulbul v2/v3/v4, ElevenLabs Flash/Turbo/…).

-- AlterTable
ALTER TABLE "WorkspaceAiSettings" ADD COLUMN "speechModel" TEXT;
