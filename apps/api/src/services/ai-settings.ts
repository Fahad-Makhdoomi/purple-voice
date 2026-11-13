import type { AiProvider, CredentialProvider, VoiceEngine } from '@prisma/client';
import {
  AI_PROVIDERS,
  CREDENTIAL_PROVIDERS,
  agentEngineChoices,
  agentModelChoices,
  engineSettingsFor,
  defaultModelForEngine,
  modelsForEngine,
  requiredProviders,
  resolveAgentModel,
  speechModelFor,
  type ModelOption,
} from '@pv/shared';
import { prisma } from '../lib/prisma';
import { getSetting } from './settings';
import { keySource, type KeySource } from './ai-keys';

/**
 * A workspace's AI layer. Staff choose it per subscriber (Admin → Subscribers
 * → AI); a workspace without its own row uses the platform default
 * (Super admin → AI providers). Subscribers never choose it.
 */
export interface AiSettings {
  voiceEngine: VoiceEngine;
  llmProvider: AiProvider;
  model: string;
  /** The engine's text-to-speech model, resolved to its default ('' when it has none). */
  speechModel: string;
  /** `workspace` when staff set this subscriber's AI, `platform` when it follows the default. */
  source: 'workspace' | 'platform';
}

export async function getAiSettings(workspaceId: string): Promise<AiSettings> {
  const row = await prisma.workspaceAiSettings.findUnique({ where: { workspaceId } });
  if (row) {
    return {
      voiceEngine: row.voiceEngine,
      llmProvider: row.llmProvider,
      model: row.model,
      speechModel: speechModelFor(row.voiceEngine, row.speechModel),
      source: 'workspace',
    };
  }
  const platform = await getSetting('ai');
  return {
    ...platform,
    speechModel: speechModelFor(platform.voiceEngine, platform.speechModel),
    source: 'platform',
  };
}

export interface AiKeyStatus {
  provider: CredentialProvider;
  /** Where the key for this vendor comes from, or null when there is none. */
  source: KeySource | null;
}

export interface AiStatus {
  settings: AiSettings;
  keys: AiKeyStatus[];
  /** Every key the engine needs is available. */
  ready: boolean;
}

/** Every vendor whose key the workspace's calls can use right now. */
export async function usableKeys(workspaceId: string): Promise<CredentialProvider[]> {
  const checks = await Promise.all(
    CREDENTIAL_PROVIDERS.map(async (p) => ((await keySource(workspaceId, p)) ? p : null)),
  );
  return checks.filter((p): p is CredentialProvider => p !== null);
}

const isAiProvider = (p: CredentialProvider): p is AiProvider =>
  (AI_PROVIDERS as readonly string[]).includes(p);

/**
 * The AI settings for an agent's own engine pick: the workspace's when it
 * picks none, or picks one whose keys aren't available.
 */
export async function engineSettings(
  workspaceId: string,
  engine: VoiceEngine | null | undefined,
  keys?: CredentialProvider[],
): Promise<AiSettings> {
  const settings = await getAiSettings(workspaceId);
  if (!engine || engine === settings.voiceEngine) return settings;
  const picked = engineSettingsFor(settings, engine, keys ?? (await usableKeys(workspaceId)));
  return picked ? { ...picked, source: settings.source } : settings;
}

/** The engines an agent in this workspace may run on, the workspace's first. */
export async function agentEngines(
  workspaceId: string,
  keys?: CredentialProvider[],
): Promise<VoiceEngine[]> {
  const settings = await getAiSettings(workspaceId);
  return agentEngineChoices(settings, keys ?? (await usableKeys(workspaceId)));
}

/** The AI settings (for the agent's engine, if given) plus, for each key that engine needs, where it comes from. */
export async function getAiStatus(
  workspaceId: string,
  engine?: VoiceEngine | null,
): Promise<AiStatus> {
  const settings = await engineSettings(workspaceId, engine);
  const keys = await Promise.all(
    requiredProviders(settings.voiceEngine, settings.llmProvider).map(async (provider) => ({
      provider,
      source: await keySource(workspaceId, provider),
    })),
  );
  return { settings, keys, ready: keys.every((k) => k.source !== null) };
}

/** The models an agent on `engine` (default: the workspace's) may pick, and what it uses when it picks none. */
export async function agentModelOptions(
  workspaceId: string,
  engine?: VoiceEngine | null,
  keys?: CredentialProvider[],
): Promise<{ models: ModelOption[]; defaultLabel: string; providers: AiProvider[] }> {
  const usable = keys ?? (await usableKeys(workspaceId));
  const settings = await engineSettings(workspaceId, engine, usable);
  const providers = usable.filter(isAiProvider);
  const models = agentModelChoices(settings.voiceEngine, providers);
  const speechToSpeech =
    settings.voiceEngine === 'REALTIME' || settings.voiceEngine === 'GEMINI_LIVE';
  const current = speechToSpeech ? settings.model : `${settings.llmProvider}:${settings.model}`;
  const known =
    models.find((m) => m.id === current)?.label ??
    modelsForEngine(settings.voiceEngine, settings.llmProvider).find((m) => m.id === settings.model)
      ?.label ??
    defaultModelForEngine(settings.voiceEngine, settings.llmProvider);
  return { models, defaultLabel: known, providers };
}

/** The AI settings one agent runs with: its engine (or the workspace's), with its own model pick applied. */
export async function aiSettingsForAgent(
  workspaceId: string,
  aiModel: string | null | undefined,
  voiceEngine?: VoiceEngine | null,
): Promise<AiSettings> {
  const keys = await usableKeys(workspaceId);
  const settings = await engineSettings(workspaceId, voiceEngine, keys);
  if (!aiModel) return settings;
  const providers = keys.filter(isAiProvider);
  return { ...settings, ...resolveAgentModel(settings.voiceEngine, settings, aiModel, providers) };
}
