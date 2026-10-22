import { Router } from 'express';
import { dialerAgentCallSchema, dialerCallSchema } from '@pv/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound, unauthorized } from '../../lib/http-error';
import { signSubject } from '../../lib/signed-url';
import { wsId } from '../../middleware/workspace';
import { requireActiveSubscription } from '../../middleware/entitlements';
import { forceEndCall, startOutboundCall } from '../../services/calls';
import { hangupDialerCall } from '../../voice/dialer-bridge';

/**
 * Browser dialer: a person calls from their computer through a connected
 * number. Placing the call returns the path of the WebSocket that carries
 * its audio (voice/dialer-bridge.ts); minutes are metered like any call.
 * In agent mode the person picks one of their agents and it makes the call
 * instead (requestedById records who asked).
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
  requestedBy: { select: { id: true, name: true } },
  agent: { select: { id: true, name: true } },
} as const;

/** Calls placed from the dialer: by a person, or by an agent someone asked to call. */
const fromDialer = { OR: [{ placedById: { not: null } }, { requestedById: { not: null } }] };

/** A CRM lead in this workspace, when the call is for one. */
async function leadIdFor(workspaceId: string, leadId: string | undefined) {
  if (!leadId) return undefined;
  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, workspaceId } });
  if (!lead) throw notFound('Lead');
  return lead.id;
}

/** Recent calls placed from the dialer in this workspace, newest first. */
dialerRouter.get('/calls', async (req, res) => {
  const calls = await prisma.call.findMany({
    where: { workspaceId: wsId(req), ...fromDialer },
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
    leadId: await leadIdFor(workspaceId, input.leadId),
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

/** An agent calls the number: the person picks the agent and the line, the agent talks. */
dialerRouter.post('/agent-calls', requireActiveSubscription, async (req, res) => {
  const input = dialerAgentCallSchema.parse(req.body);
  const workspaceId = wsId(req);
  const userId = req.user?.id;
  if (!userId) throw unauthorized();

  const [agent, number] = await Promise.all([
    prisma.agent.findFirst({ where: { id: input.agentId, workspaceId } }),
    prisma.phoneNumber.findFirst({ where: { id: input.phoneNumberId, workspaceId } }),
  ]);
  if (!agent) throw notFound('Agent');
  if (agent.status !== 'ACTIVE') throw badRequest(`Turn ${agent.name} on before it makes calls`);
  if (!number) throw notFound('Phone number');
  if (number.e164 === input.to) throw badRequest("That's the number you're calling from");

  const placed = await startOutboundCall({
    workspaceId,
    agentId: agent.id,
    requestedById: userId,
    phoneNumberId: number.id,
    to: input.to,
    leadId: await leadIdFor(workspaceId, input.leadId),
  });
  await audit(req, 'dialer.agent_call_started', {
    entity: 'Call',
    entityId: placed.id,
    meta: { from: number.e164, agentId: agent.id },
  });
  const call = await prisma.call.findUniqueOrThrow({ where: { id: placed.id }, select: callView });
  res.status(201).json({ call });
});

/** Ends a dialer call (yours or an agent's), or cancels it while it's still ringing. */
dialerRouter.post('/calls/:id/hangup', async (req, res) => {
  const workspaceId = wsId(req);
  const call = await prisma.call.findFirst({
    where: { id: String(req.params.id), workspaceId, ...fromDialer },
    select: { id: true, placedById: true },
  });
  if (!call) throw notFound('Call');
  if (call.placedById) await hangupDialerCall(call.id);
  else await forceEndCall(workspaceId, call.id);
  res.json({ ok: true });
});
