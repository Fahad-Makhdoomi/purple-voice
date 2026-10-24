import type { AiProvider, CredentialProvider, VoiceEngine } from '@prisma/client';
import { requiredProviders, speechModelFor } from '@pv/shared';
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

/** The workspace's AI settings plus, for each key its engine needs, where that key comes from. */
export async function getAiStatus(workspaceId: string): Promise<AiStatus> {
  const settings = await getAiSettings(workspaceId);
  const keys = await Promise.all(
    requiredProviders(settings.voiceEngine, settings.llmProvider).map(async (provider) => ({
      provider,
      source: await keySource(workspaceId, provider),
    })),
  );
  return { settings, keys, ready: keys.every((k) => k.source !== null) };
}
