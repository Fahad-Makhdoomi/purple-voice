import { Router } from 'express';
import {
  agentSchema,
  testCallSchema,
  updateAgentSchema,
  voicesForEngine,
  type AgentInput,
  type Entitlements,
} from '@pv/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound, planLimit } from '../../lib/http-error';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { agentReadiness } from '../../services/agent-readiness';
import { getAiSettings } from '../../services/ai-settings';
import { startOutboundCall } from '../../services/calls';

export const agentsRouter = Router();

/** Cross-field rules zod can't see: plan features and owned references. */
async function assertAgentConfig(
  workspaceId: string,
  ent: Entitlements,
  input: Partial<AgentInput>,
) {
  if (input.transferEnabled) {
    if (!ent.features.callTransfer) throw planLimit('Call transfer is not included in your plan');
    if (!input.transferNumber) throw badRequest('Add the number calls should be transferred to');
  }
  if (input.appointmentBookingEnabled && !ent.features.appointmentBooking) {
    throw planLimit('Appointment booking is not included in your plan');
  }
  if (input.calendarIntegrationId) {
    const integration = await prisma.integration.findFirst({
      where: { id: input.calendarIntegrationId, workspaceId, type: 'GOOGLE_CALENDAR' },
    });
    if (!integration) throw badRequest('Connect Google Calendar before linking it to an agent');
  }
}

/**
 * A voice the subscriber picks must be one the workspace's engine offers.
 * Staff choose the engine; if they change it later, agents with an old voice
 * keep working on the engine's default voice until the subscriber picks again.
 */
async function assertVoice(workspaceId: string, voice: string | undefined) {
  if (voice === undefined) return;
  const { voiceEngine } = await getAiSettings(workspaceId);
  if (!voicesForEngine(voiceEngine).some((v) => v.id === voice)) {
    throw badRequest('Choose one of the available voices');
  }
}

agentsRouter.get('/', async (req, res) => {
  const agents = await prisma.agent.findMany({
    where: { workspaceId: wsId(req) },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { calls: true, campaigns: true } },
      inboundNumbers: { select: { id: true, e164: true } },
    },
  });
  res.json({ agents });
});

agentsRouter.post('/', requireActiveSubscription, async (req, res) => {
  const input = agentSchema.parse(req.body);
  const workspaceId = wsId(req);
  const ent = await entitlementsFor(req);
  await assertWithinLimit(workspaceId, ent, 'agents');
  await assertVoice(workspaceId, input.voice);
  await assertAgentConfig(workspaceId, ent, input);

  const agent = await prisma.agent.create({ data: { ...input, workspaceId } });
  await audit(req, 'agent.created', { entity: 'Agent', entityId: agent.id });
  res.status(201).json({ agent });
});

agentsRouter.get('/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, workspaceId },
    include: { inboundNumbers: { select: { id: true, e164: true, friendlyName: true } } },
  });
  if (!agent) throw notFound('Agent');
  const stats = await prisma.call.groupBy({
    by: ['outcome'],
    where: { agentId: agent.id },
    _count: { _all: true },
  });
  res.json({ agent, readiness: await agentReadiness(workspaceId, agent), outcomes: stats });
});

agentsRouter.patch('/:id', async (req, res) => {
  const input = updateAgentSchema.parse(req.body);
  const workspaceId = wsId(req);
  const existing = await prisma.agent.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!existing) throw notFound('Agent');
  const ent = await entitlementsFor(req);
  await assertVoice(workspaceId, input.voice);
  // Validate against the merged result, so a partial update can't leave the agent inconsistent.
  await assertAgentConfig(workspaceId, ent, { ...existing, ...input } as Partial<AgentInput>);

  if (input.status === 'ACTIVE') {
    const readiness = await agentReadiness(workspaceId, { ...existing, ...input });
    const blocking = readiness.filter((r) => !r.ok && r.blocking);
    if (blocking.length)
      throw badRequest(`Before activating: ${blocking.map((b) => b.label).join('; ')}`);
  }

  const agent = await prisma.agent.update({ where: { id: existing.id }, data: input });
  await audit(req, 'agent.updated', { entity: 'Agent', entityId: agent.id });
  res.json({ agent });
});

agentsRouter.delete('/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const agent = await prisma.agent.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!agent) throw notFound('Agent');
  const campaigns = await prisma.campaign.count({ where: { agentId: agent.id } });
  if (campaigns)
    throw badRequest('This agent is used by campaigns. Reassign or delete them first.');
  await prisma.agent.delete({ where: { id: agent.id } });
  await audit(req, 'agent.deleted', { entity: 'Agent', entityId: agent.id });
  res.json({ ok: true });
});

/** Rings the given number with this agent so the subscriber can hear it before going live. */
agentsRouter.post('/:id/test-call', requireActiveSubscription, async (req, res) => {
  const input = testCallSchema.parse(req.body);
  const workspaceId = wsId(req);
  const agent = await prisma.agent.findFirst({ where: { id: String(req.params.id), workspaceId } });
  if (!agent) throw notFound('Agent');
  const number = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId },
  });
  if (!number) throw notFound('Phone number');

  const call = await startOutboundCall({
    workspaceId,
    agentId: agent.id,
    phoneNumberId: number.id,
    to: input.to,
  });
  await audit(req, 'agent.test_call', { entity: 'Call', entityId: call.id });
  res.status(201).json({ call });
});
