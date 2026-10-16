import { Router } from 'express';
import { dialerCallSchema } from '@pv/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound, unauthorized } from '../../lib/http-error';
import { signSubject } from '../../lib/signed-url';
import { wsId } from '../../middleware/workspace';
import { requireActiveSubscription } from '../../middleware/entitlements';
import { startOutboundCall } from '../../services/calls';
import { hangupDialerCall } from '../../voice/dialer-bridge';

/**
 * Browser dialer: a person calls from their computer through a connected
 * number. Placing the call returns the path of the WebSocket that carries
 * its audio (voice/dialer-bridge.ts); minutes are metered like any call.
 */
export const dialerRouter = Router();

const callView = {
  id: true,
  status: true,
  fromNumber: true,
  toNumber: true,
  durationSec: true,
  createdAt: true,
  answeredAt: true,
  endedAt: true,
  endReason: true,
  placedBy: { select: { id: true, name: true } },
} as const;

/** Recent calls placed from the dialer in this workspace, newest first. */
dialerRouter.get('/calls', async (req, res) => {
  const calls = await prisma.call.findMany({
    where: { workspaceId: wsId(req), placedById: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: callView,
  });
  res.json({ calls });
});

dialerRouter.post('/calls', requireActiveSubscription, async (req, res) => {
  const input = dialerCallSchema.parse(req.body);
  const workspaceId = wsId(req);
  const userId = req.user?.id;
  if (!userId) throw unauthorized();

  const number = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId },
  });
  if (!number) throw notFound('Phone number');
  if (number.e164 === input.to) throw badRequest("That's the number you're calling from");

  // Checks minutes and concurrent calls, and that the carrier can stream audio.
  const placed = await startOutboundCall({
    workspaceId,
    placedById: userId,
    phoneNumberId: number.id,
    to: input.to,
  });
  await audit(req, 'dialer.call_started', {
    entity: 'Call',
    entityId: placed.id,
    meta: { from: number.e164 },
  });
  const call = await prisma.call.findUniqueOrThrow({ where: { id: placed.id }, select: callView });
  res.status(201).json({
    call,
    socketPath: `/ws/dialer/${call.id}/${signSubject('dialer', call.id)}`,
  });
});

/** Ends a dialer call, or cancels it while it's still ringing. */
dialerRouter.post('/calls/:id/hangup', async (req, res) => {
  const call = await prisma.call.findFirst({
    where: { id: String(req.params.id), workspaceId: wsId(req), placedById: { not: null } },
    select: { id: true },
  });
  if (!call) throw notFound('Call');
  await hangupDialerCall(call.id);
  res.json({ ok: true });
});
