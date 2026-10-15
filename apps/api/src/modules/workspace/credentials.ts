import { Router } from 'express';
import { aiCredentialSchema, CREDENTIAL_PROVIDERS } from '@pv/shared';
import type { CredentialProvider } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { encrypt, last4 } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { badRequest } from '../../lib/http-error';
import { wsId } from '../../middleware/workspace';
import { verifyApiKey } from '../../services/ai-keys';

/** Bring-your-own keys for OpenAI, Claude, Gemini and Deepgram. Keys never leave the API decrypted. */
export const credentialsRouter = Router();

credentialsRouter.get('/', async (req, res) => {
  const rows = await prisma.aiCredential.findMany({ where: { workspaceId: wsId(req) } });
  res.json({
    credentials: CREDENTIAL_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      return {
        provider,
        connected: !!row,
        label: row?.label ?? null,
        last4: row?.last4 ?? null,
        verifiedAt: row?.verifiedAt ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    }),
  });
});

credentialsRouter.put('/', async (req, res) => {
  const input = aiCredentialSchema.parse(req.body);
  await verifyApiKey(input.provider, input.apiKey);
  const workspaceId = wsId(req);
  await prisma.aiCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider: input.provider } },
    create: {
      workspaceId,
      provider: input.provider,
      label: input.label,
      apiKeyEnc: encrypt(input.apiKey),
      last4: last4(input.apiKey),
      verifiedAt: new Date(),
    },
    update: {
      label: input.label,
      apiKeyEnc: encrypt(input.apiKey),
      last4: last4(input.apiKey),
      verifiedAt: new Date(),
    },
  });
  await audit(req, 'credential.saved', { entity: 'AiCredential', meta: { provider: input.provider } });
  res.json({ ok: true });
});

credentialsRouter.delete('/:provider', async (req, res) => {
  const provider = req.params.provider.toUpperCase() as CredentialProvider;
  if (!CREDENTIAL_PROVIDERS.includes(provider)) throw badRequest('Unknown provider');
  await prisma.aiCredential.deleteMany({ where: { workspaceId: wsId(req), provider } });
  await audit(req, 'credential.removed', { entity: 'AiCredential', meta: { provider } });
  res.json({ ok: true });
});
