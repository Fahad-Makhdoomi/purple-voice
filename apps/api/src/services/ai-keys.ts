import Anthropic from '@anthropic-ai/sdk';
import type { CredentialProvider } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { badRequest } from '../lib/http-error';
import { CREDENTIAL_PROVIDER_LABELS } from '@pv/shared';

/**
 * Where an AI key comes from. Staff manage both kinds; subscribers never see
 * them.
 *
 *  workspace  a key staff added for this subscriber (Admin → Subscribers → AI)
 *  platform   the platform's key (Super admin → AI providers)
 *  env        ANTHROPIC_API_KEY from the server environment, the last resort for Claude
 */
export type KeySource = 'workspace' | 'platform' | 'env';

async function lookup(
  workspaceId: string,
  provider: CredentialProvider,
): Promise<{ source: KeySource; apiKeyEnc?: string; plain?: string } | null> {
  const own = await prisma.aiCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
    select: { apiKeyEnc: true },
  });
  if (own) return { source: 'workspace', apiKeyEnc: own.apiKeyEnc };
  const platform = await prisma.platformCredential.findUnique({
    where: { provider },
    select: { apiKeyEnc: true },
  });
  if (platform) return { source: 'platform', apiKeyEnc: platform.apiKeyEnc };
  if (provider === 'ANTHROPIC' && env.ANTHROPIC_API_KEY) {
    return { source: 'env', plain: env.ANTHROPIC_API_KEY };
  }
  return null;
}

/** The key a workspace's calls use for a vendor: its own, else the platform's. */
export async function findApiKey(
  workspaceId: string,
  provider: CredentialProvider,
): Promise<string | null> {
  const found = await lookup(workspaceId, provider);
  if (!found) return null;
  return found.plain ?? decrypt(found.apiKeyEnc!);
}

/** Where `findApiKey` would get the key from, without decrypting it. */
export async function keySource(
  workspaceId: string,
  provider: CredentialProvider,
): Promise<KeySource | null> {
  return (await lookup(workspaceId, provider))?.source ?? null;
}

/** The platform's own key for a vendor (Super admin → AI providers, then the environment). */
export async function findPlatformApiKey(provider: CredentialProvider): Promise<string | null> {
  const row = await prisma.platformCredential.findUnique({ where: { provider } });
  if (row) return decrypt(row.apiKeyEnc);
  return provider === 'ANTHROPIC' ? (env.ANTHROPIC_API_KEY ?? null) : null;
}

/**
 * Makes the cheapest authenticated request each vendor offers (listing
 * models or projects) to prove a key works before we store it.
 */
export async function verifyApiKey(provider: CredentialProvider, apiKey: string): Promise<void> {
  try {
    switch (provider) {
      case 'ANTHROPIC': {
        const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 10_000 });
        await client.models.list({ limit: 1 });
        return;
      }
      case 'OPENAI': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return;
      }
      case 'GEMINI': {
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
          {
            headers: { 'x-goog-api-key': apiKey },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return;
      }
      case 'DEEPGRAM': {
        const res = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { Authorization: `Token ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return;
      }
      case 'ELEVENLABS': {
        // Voice agents are all this key is for, so check it can read them.
        const res = await fetch('https://api.elevenlabs.io/v1/convai/agents?page_size=1', {
          headers: { 'xi-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return;
      }
    }
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      throw badRequest('Claude rejected that API key');
    }
    throw badRequest(
      `${CREDENTIAL_PROVIDER_LABELS[provider]} rejected that key (${(err as Error).message}). Check it and try again.`,
    );
  }
}
