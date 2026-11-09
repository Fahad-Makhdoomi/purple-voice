-- Subscribers pick the AI model per agent (always on the platform keys).
ALTER TABLE "Agent" ADD COLUMN "aiModel" TEXT;
