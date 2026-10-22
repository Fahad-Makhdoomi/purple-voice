import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { isOnDoNotCall } from '../services/do-not-call';
import { startOutboundCall } from '../services/calls';
import { addActivity } from '../services/crm';

/** How long a new lead keeps waiting for a free line before we give up. */
const GIVE_UP_AFTER_MS = 2 * 60 * 60 * 1000;
const BUSY_RETRY_MS = 60_000;

/**
 * New-lead calls: an agent calls each lead whose callDueAt has come (set by
 * intakeLead when a lead arrives from WhatsApp or the lead webhook). Each lead
 * is claimed by clearing callDueAt, so it is called once.
 */
export async function crmTick() {
  const due = await prisma.crmLead.findMany({
    where: { callDueAt: { lte: new Date() } },
    orderBy: { callDueAt: 'asc' },
    take: 20,
    select: { id: true, workspaceId: true, phone: true, callDueAt: true, createdAt: true },
  });
  for (const lead of due) {
    const claimed = await prisma.crmLead.updateMany({
      where: { id: lead.id, callDueAt: lead.callDueAt },
      data: { callDueAt: null },
    });
    if (!claimed.count) continue;
    await callNewLead(lead).catch((err) =>
      logger.error({ err, leadId: lead.id }, 'New-lead call failed'),
    );
  }
}

async function callNewLead(lead: {
  id: string;
  workspaceId: string;
  phone: string;
  createdAt: Date;
}) {
  const settings = await prisma.crmSettings.findUnique({
    where: { workspaceId: lead.workspaceId },
  });
  if (!settings?.instantCallEnabled || !settings.instantAgentId || !settings.instantNumberId)
    return;
  if (await isOnDoNotCall(lead.workspaceId, lead.phone)) {
    await addActivity(lead.id, 'call', 'Not called: the number is on your do-not-call list');
    return;
  }
  const agent = await prisma.agent.findFirst({
    where: { id: settings.instantAgentId, workspaceId: lead.workspaceId },
  });
  if (agent?.status !== 'ACTIVE') {
    await addActivity(lead.id, 'call', "Not called: the agent for new leads isn't active");
    return;
  }
  try {
    const call = await startOutboundCall({
      workspaceId: lead.workspaceId,
      agentId: agent.id,
      phoneNumberId: settings.instantNumberId,
      to: lead.phone,
      leadId: lead.id,
    });
    await addActivity(lead.id, 'call', `${agent.name} is calling them`, { callId: call.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The call could not be placed';
    if (
      /concurrent call limit/i.test(message) &&
      Date.now() - lead.createdAt.getTime() < GIVE_UP_AFTER_MS
    ) {
      // Every line is busy: try again in a minute.
      await prisma.crmLead.update({
        where: { id: lead.id },
        data: { callDueAt: new Date(Date.now() + BUSY_RETRY_MS) },
      });
      return;
    }
    await addActivity(lead.id, 'call', `Not called: ${message}`);
  }
}
