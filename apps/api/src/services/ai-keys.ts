import Anthropic from '@anthropic-ai/sdk';
import type { CredentialProvider } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { badRequest } from '../lib/http-error';
import { CREDENTIAL_PROVIDER_LABELS } from '@pv/shared';

/** A workspace's decrypted key for a vendor, or a clear error telling them to add one. */
export async function requireApiKey(workspaceId: string, provider: CredentialProvider): Promise<string> {
  const cred = await prisma.aiCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (!cred) {
    throw badRequest(`Add your ${CREDENTIAL_PROVIDER_LABELS[provider]} API key under Integrations first`);
  }
  return decrypt(cred.apiKeyEnc);
}

export async function findApiKey(workspaceId: string, provider: CredentialProvider): Promise<string | null> {
  const cred = await prisma.aiCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  return cred ? decrypt(cred.apiKeyEnc) : null;
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
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
          headers: { 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
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
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw badRequest('Claude rejected that API key');
    }
    throw badRequest(
      `${CREDENTIAL_PROVIDER_LABELS[provider]} rejected that key (${(err as Error).message}). Check it and try again.`,
    );
  }
}
