import { Router } from 'express';
import { connectNumberSchema, telephonyAccountSchema, updateNumberSchema } from '@pv/shared';
import { prisma } from '../../lib/prisma';
import { encryptJson } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/http-error';
import { signedCallbackUrl } from '../../lib/signed-url';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { adapterForAccount, createAdapter, TelephonyError } from '../../telephony';

/**
 * Telephony accounts (the subscriber's own Twilio / Plivo / SuperPhone
 * credentials) and the phone numbers connected through them. Number rental
 * stays on the subscriber's carrier bill; we only point the number's voice
 * webhook at Purple Voice.
 */
export const telephonyRouter = Router();

function asHttp(err: unknown): never {
  if (err instanceof TelephonyError) {
    throw new HttpError(err.status === 501 ? 501 : 400, err.message, 'telephony_error');
  }
  throw err;
}

// ── Accounts ────────────────────────────────────────────────────────────────

telephonyRouter.get('/accounts', async (req, res) => {
  const accounts = await prisma.telephonyAccount.findMany({
    where: { workspaceId: wsId(req) },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { phoneNumbers: true } } },
  });
  res.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label,
      publicId: a.publicId,
      verifiedAt: a.verifiedAt,
      numberCount: a._count.phoneNumbers,
      createdAt: a.createdAt,
    })),
  });
});

telephonyRouter.post('/accounts', requireActiveSubscription, async (req, res) => {
  const input = telephonyAccountSchema.parse(req.body);
  const { provider, label, ...secret } = input;
  const adapter = createAdapter(provider, secret);
  const verified = await adapter.verify().catch(asHttp);
  const publicId =
    input.provider === 'TWILIO'
      ? input.accountSid
      : input.provider === 'PLIVO'
        ? input.authId
        : `••••${input.apiKey.slice(-4)}`;

  const account = await prisma.telephonyAccount.create({
    data: {
      workspaceId: wsId(req),
      provider,
      label: label || verified.label,
      credentialsEnc: encryptJson(secret),
      publicId,
      verifiedAt: new Date(),
    },
  });
  await audit(req, 'telephony.account_added', {
    entity: 'TelephonyAccount',
    entityId: account.id,
    meta: { provider },
  });
  res.status(201).json({ account: { id: account.id, provider, label: account.label, publicId } });
});

telephonyRouter.delete('/accounts/:id', async (req, res) => {
  const result = await prisma.telephonyAccount.deleteMany({
    where: { id: req.params.id, workspaceId: wsId(req) },
  });
  if (!result.count) throw notFound('Telephony account');
  await audit(req, 'telephony.account_removed', {
    entity: 'TelephonyAccount',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});

/** Numbers on the carrier account, so the subscriber can pick instead of typing. */
telephonyRouter.get('/accounts/:id/available-numbers', async (req, res) => {
  const account = await prisma.telephonyAccount.findFirst({
    where: { id: req.params.id, workspaceId: wsId(req) },
  });
  if (!account) throw notFound('Telephony account');
  const numbers = await adapterForAccount(account).listNumbers().catch(asHttp);
  const connected = await prisma.phoneNumber.findMany({
    where: { workspaceId: account.workspaceId },
    select: { e164: true },
  });
  const taken = new Set(connected.map((n) => n.e164));
  res.json({ numbers: numbers.map((n) => ({ ...n, connected: taken.has(n.e164) })) });
});

// ── Numbers ─────────────────────────────────────────────────────────────────

telephonyRouter.get('/numbers', async (req, res) => {
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: wsId(req) },
    orderBy: { createdAt: 'asc' },
    include: {
      telephonyAccount: { select: { provider: true, label: true } },
      inboundAgent: { select: { id: true, name: true } },
    },
  });
  res.json({ numbers });
});

async function configureRouting(numberId: string) {
  const number = await prisma.phoneNumber.findUniqueOrThrow({
    where: { id: numberId },
    include: { telephonyAccount: true },
  });
  const adapter = adapterForAccount(number.telephonyAccount);
  try {
    const result = await adapter.configureInbound({
      e164: number.e164,
      providerNumberId: number.providerNumberId,
      numberId: number.id,
      inboundUrl: signedCallbackUrl(
        number.telephonyAccount.provider,
        'inbound',
        'numberId',
        number.id,
      ),
      statusUrl: signedCallbackUrl(
        number.telephonyAccount.provider,
        'status',
        'numberId',
        number.id,
      ),
      existingAppId: number.providerAppId,
    });
    await prisma.phoneNumber.update({
      where: { id: number.id },
      data: {
        providerNumberId: result.providerNumberId ?? number.providerNumberId,
        providerAppId: 'appId' in result && result.appId ? result.appId : number.providerAppId,
        routingConfigured: adapter.mediaProtocol !== 'none',
        routingError:
          adapter.mediaProtocol === 'none' ? 'Provider call control not available yet' : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not configure routing';
    await prisma.phoneNumber.update({
      where: { id: number.id },
      data: { routingConfigured: false, routingError: message },
    });
  }
}

telephonyRouter.post('/numbers', requireActiveSubscription, async (req, res) => {
  const input = connectNumberSchema.parse(req.body);
  const workspaceId = wsId(req);
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'phoneNumbers');

  const account = await prisma.telephonyAccount.findFirst({
    where: { id: input.telephonyAccountId, workspaceId },
  });
  if (!account) throw notFound('Telephony account');
  if (input.inboundAgentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: input.inboundAgentId, workspaceId },
    });
    if (!agent) throw badRequest('That agent does not exist');
  }

  const number = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      telephonyAccountId: account.id,
      e164: input.e164,
      friendlyName: input.friendlyName,
      providerNumberId: input.providerNumberId,
      inboundAgentId: input.inboundAgentId ?? null,
    },
  });
  await configureRouting(number.id);
  await audit(req, 'number.connected', {
    entity: 'PhoneNumber',
    entityId: number.id,
    meta: { e164: input.e164 },
  });
  res
    .status(201)
    .json({ number: await prisma.phoneNumber.findUnique({ where: { id: number.id } }) });
});

telephonyRouter.patch('/numbers/:id', async (req, res) => {
  const input = updateNumberSchema.parse(req.body);
  const workspaceId = wsId(req);
  const number = await prisma.phoneNumber.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!number) throw notFound('Phone number');
  if (input.inboundAgentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: input.inboundAgentId, workspaceId },
    });
    if (!agent) throw badRequest('That agent does not exist');
  }
  const updated = await prisma.phoneNumber.update({
    where: { id: number.id },
    data: { friendlyName: input.friendlyName, inboundAgentId: input.inboundAgentId },
  });
  res.json({ number: updated });
});

/** Re-applies our webhook URLs on the carrier (e.g. after the domain changes). */
telephonyRouter.post('/numbers/:id/resync', requireActiveSubscription, async (req, res) => {
  const number = await prisma.phoneNumber.findFirst({
    where: { id: String(req.params.id), workspaceId: wsId(req) },
  });
  if (!number) throw notFound('Phone number');
  await configureRouting(number.id);
  res.json({ number: await prisma.phoneNumber.findUnique({ where: { id: number.id } }) });
});

telephonyRouter.delete('/numbers/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const inUse = await prisma.campaign.count({
    where: {
      phoneNumberId: req.params.id,
      workspaceId,
      status: { in: ['RUNNING', 'PAUSED', 'DRAFT'] },
    },
  });
  if (inUse)
    throw badRequest('This number is used by a campaign. Change or cancel the campaign first.');
  const result = await prisma.phoneNumber.deleteMany({ where: { id: req.params.id, workspaceId } });
  if (!result.count) throw notFound('Phone number');
  await audit(req, 'number.disconnected', { entity: 'PhoneNumber', entityId: req.params.id });
  res.json({ ok: true });
});
