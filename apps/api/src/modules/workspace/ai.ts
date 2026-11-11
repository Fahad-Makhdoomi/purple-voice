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
import { voicePreview } from '../../services/voice-previews';
import { voicePreviewLimiter } from '../../middleware/rate-limit';

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

/**
 * GET /api/app/ai/voices/:voice/preview?lang=hi — a short sample of a voice
 * the workspace can use, spoken by its own voice engine (cached after the
 * first play). `lang` is the agent's language, for voices that speak several.
 */
aiRouter.get('/voices/:voice/preview', voicePreviewLimiter, async (req, res) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang.slice(0, 12) : undefined;
  const { audio, contentType } = await voicePreview(wsId(req), String(req.params.voice), lang);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(audio);
});
