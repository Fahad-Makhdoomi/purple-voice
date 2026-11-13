-- Each agent may pick its own voice engine; null follows the workspace.
ALTER TABLE "Agent" ADD COLUMN "voiceEngine" "VoiceEngine";
