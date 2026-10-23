import { Router } from 'express';
import {
  DEFAULT_VOICE,
  languagesForEngine,
  voicesForEngine,
  type WorkspaceAiView,
} from '@pv/shared';
import { wsId } from '../../middleware/workspace';
import { getAiStatus } from '../../services/ai-settings';
import { findApiKey } from '../../services/ai-keys';
import { tryListElevenLabsVoices } from '../../services/elevenlabs-voices';

/**
 * What the agent builder needs about the AI layer: the voices it may offer
 * and whether the AI is ready. Staff choose the engine, model and keys
 * (Admin → Subscribers → AI), so no vendor, model or key ever appears here.
 */
export const aiRouter = Router();

aiRouter.get('/', async (req, res) => {
  const { settings, ready } = await getAiStatus(wsId(req));
  const elevenLabs = settings.voiceEngine === 'ELEVENLABS';
  // ElevenLabs: every voice on the account; the premade list if it can't be reached.
  const key = elevenLabs ? await findApiKey(wsId(req), 'ELEVENLABS') : null;
  const accountVoices = key ? await tryListElevenLabsVoices(key) : null;
  const view: WorkspaceAiView = {
    voices: accountVoices ?? voicesForEngine(settings.voiceEngine),
    defaultVoice: DEFAULT_VOICE[settings.voiceEngine],
    languages: [...languagesForEngine(settings.voiceEngine)],
    customVoice: elevenLabs,
    ready,
  };
  res.json(view);
});
