import { Router } from 'express';
import {
  AGENT_ENGINE_OPTIONS,
  VOICE_ENGINES,
  defaultVoiceFor,
  languagesForEngine,
  voicesForEngine,
  type AgentEngineView,
  type CredentialProvider,
  type VoiceEngine,
  type WorkspaceAiView,
} from '@pv/shared';
import { wsId } from '../../middleware/workspace';
import {
  agentEngines,
  agentModelOptions,
  engineSettings,
  getAiStatus,
  usableKeys,
} from '../../services/ai-settings';
import { findApiKey } from '../../services/ai-keys';
import { tryListElevenLabsVoices } from '../../services/elevenlabs-voices';
import { voicePreview } from '../../services/voice-previews';
import { voicePreviewLimiter } from '../../middleware/rate-limit';

/**
 * What the agent builder needs about the AI layer: the voice engines an
 * agent can run on (the workspace's, chosen by staff, plus every other one
 * the platform has keys for), each with its voices and AI models, and
 * whether the AI is ready. Everything runs on our keys, which subscribers
 * never see.
 */
export const aiRouter = Router();

async function engineView(
  workspaceId: string,
  engine: VoiceEngine,
  keys: CredentialProvider[],
): Promise<AgentEngineView> {
  const [settings, options] = await Promise.all([
    engineSettings(workspaceId, engine, keys),
    agentModelOptions(workspaceId, engine, keys),
  ]);
  const elevenLabs = engine === 'ELEVENLABS';
  // ElevenLabs: every voice on the account; the premade list if it can't be reached.
  const key = elevenLabs ? await findApiKey(workspaceId, 'ELEVENLABS') : null;
  const accountVoices = key ? await tryListElevenLabsVoices(key) : null;
  return {
    id: engine,
    ...AGENT_ENGINE_OPTIONS[engine],
    voices: accountVoices ?? voicesForEngine(engine, settings.speechModel),
    defaultVoice: defaultVoiceFor(engine, settings.speechModel),
    languages: [...languagesForEngine(engine)],
    customVoice: elevenLabs,
    models: options.models,
    defaultModelLabel: options.defaultLabel,
  };
}

aiRouter.get('/', async (req, res) => {
  const workspaceId = wsId(req);
  const keys = await usableKeys(workspaceId);
  const [{ ready }, engines] = await Promise.all([
    getAiStatus(workspaceId),
    agentEngines(workspaceId, keys),
  ]);
  const views = await Promise.all(engines.map((e) => engineView(workspaceId, e, keys)));
  const main = views[0]!;
  const view: WorkspaceAiView = {
    defaultEngine: main.id,
    engines: views,
    voices: main.voices,
    defaultVoice: main.defaultVoice,
    languages: main.languages,
    customVoice: main.customVoice,
    ready,
    models: main.models,
    defaultModelLabel: main.defaultModelLabel,
  };
  res.json(view);
});

/**
 * GET /api/app/ai/voices/:voice/preview?lang=hi — a short sample of a voice
 * the workspace can use, spoken by its own voice engine (cached after the
 * first play). `lang` is the agent's language, for voices that speak several;
 * `engine` the agent's own engine, when it picked one.
 */
aiRouter.get('/voices/:voice/preview', voicePreviewLimiter, async (req, res) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang.slice(0, 12) : undefined;
  const engine = (VOICE_ENGINES as readonly string[]).includes(String(req.query.engine))
    ? (req.query.engine as VoiceEngine)
    : undefined;
  const { audio, contentType } = await voicePreview(
    wsId(req),
    String(req.params.voice),
    lang,
    engine,
  );
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(audio);
});
