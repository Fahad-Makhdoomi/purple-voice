-- ElevenLabs voice agents: a new voice engine and a new vendor key.

-- AlterEnum
ALTER TYPE "VoiceEngine" ADD VALUE 'ELEVENLABS';

-- AlterEnum
ALTER TYPE "CredentialProvider" ADD VALUE 'ELEVENLABS';
