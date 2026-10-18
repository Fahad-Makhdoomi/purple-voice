import type { Agent } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getAiStatus } from './ai-settings';
import { messagingChannels } from './messaging';

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  /** Blocking items must pass before the agent can be activated. */
  blocking: boolean;
}

/**
 * The checklist the agent builder shows: what is still missing before this
 * agent can take calls. Activation refuses while a blocking item fails.
 *
 * Subscribers read this, so the AI item never names a vendor: staff set up
 * the AI layer and its keys, and the subscriber only sees whether it's ready.
 */
export async function agentReadiness(
  workspaceId: string,
  agent: Pick<
    Agent,
    'appointmentBookingEnabled' | 'calendarIntegrationId' | 'transferEnabled' | 'transferNumber'
  > &
    Partial<Pick<Agent, 'emailEnabled' | 'whatsappEnabled'>> & { id?: string },
): Promise<ReadinessItem[]> {
  const [ai, numbers, messaging] = await Promise.all([
    getAiStatus(workspaceId),
    agent.id ? prisma.phoneNumber.count({ where: { workspaceId } }) : 0,
    agent.emailEnabled || agent.whatsappEnabled
      ? messagingChannels(workspaceId)
      : { email: false, whatsapp: false },
  ]);

  const items: ReadinessItem[] = [
    {
      key: 'ai',
      label: 'AI voice set up by the Purple Voice team',
      ok: ai.ready,
      blocking: true,
    },
    { key: 'number', label: 'Connect a phone number', ok: numbers > 0, blocking: false },
  ];
  if (agent.appointmentBookingEnabled) {
    items.push({
      key: 'calendar',
      label: 'Link a Google Calendar for bookings',
      ok: !!agent.calendarIntegrationId,
      blocking: false,
    });
  }
  if (agent.emailEnabled) {
    items.push({
      key: 'email',
      label: 'Connect Email (SMTP) under Integrations so the agent can send emails',
      ok: messaging.email,
      blocking: false,
    });
  }
  if (agent.whatsappEnabled) {
    items.push({
      key: 'whatsapp',
      label: 'Connect WhatsApp under Integrations so the agent can send messages',
      ok: messaging.whatsapp,
      blocking: false,
    });
  }
  if (agent.transferEnabled) {
    items.push({
      key: 'transfer',
      label: 'Set a transfer number',
      ok: !!agent.transferNumber,
      blocking: true,
    });
  }
  return items;
}
