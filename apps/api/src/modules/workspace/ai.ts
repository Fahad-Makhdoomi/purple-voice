import { Router } from 'express';
import {
  defaultVoiceFor,
  languagesForEngine,
  voicesForEngine,
  type WorkspaceAiView,
} from '@pv/shared';
import { wsId } from '../../middleware/workspace';
import { agentModelOptions, getAiStatus } from '../../services/ai-settings';
import { findApiKey } from '../../services/ai-keys';
import { tryListElevenLabsVoices } from '../../services/elevenlabs-voices';

/**
 * What the agent builder needs about the AI layer: the voices it may offer
 * and whether the AI is ready. Staff choose the engine and keys (Admin →
 * Subscribers → AI); subscribers may pick a model per agent from the list
 * offered here, always on our keys, which they never see.
 */
export const aiRouter = Router();

aiRouter.get('/', async (req, res) => {
  const [{ settings, ready }, options] = await Promise.all([
    getAiStatus(wsId(req)),
    agentModelOptions(wsId(req)),
  ]);
  const elevenLabs = settings.voiceEngine === 'ELEVENLABS';
  // ElevenLabs: every voice on the account; the premade list if it can't be reached.
  const key = elevenLabs ? await findApiKey(wsId(req), 'ELEVENLABS') : null;
  const accountVoices = key ? await tryListElevenLabsVoices(key) : null;
  const view: WorkspaceAiView = {
    voices: accountVoices ?? voicesForEngine(settings.voiceEngine, settings.speechModel),
    defaultVoice: defaultVoiceFor(settings.voiceEngine, settings.speechModel),
    languages: [...languagesForEngine(settings.voiceEngine)],
    customVoice: elevenLabs,
    ready,
    models: options.models,
    defaultModelLabel: options.defaultLabel,
  };
  res.json(view);
});
