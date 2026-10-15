import { Router } from 'express';
import { DEFAULT_VOICE, voicesForEngine, type WorkspaceAiView } from '@pv/shared';
import { wsId } from '../../middleware/workspace';
import { getAiStatus } from '../../services/ai-settings';

/**
 * What the agent builder needs about the AI layer: the voices it may offer
 * and whether the AI is ready. Staff choose the engine, model and keys
 * (Admin → Subscribers → AI), so no vendor, model or key ever appears here.
 */
export const aiRouter = Router();

aiRouter.get('/', async (req, res) => {
  const { settings, ready } = await getAiStatus(wsId(req));
  const view: WorkspaceAiView = {
    voices: voicesForEngine(settings.voiceEngine),
    defaultVoice: DEFAULT_VOICE[settings.voiceEngine],
    ready,
  };
  res.json(view);
});
