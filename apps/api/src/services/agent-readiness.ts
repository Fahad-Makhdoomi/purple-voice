import type { Agent } from '@prisma/client';
import { prisma } from '../lib/prisma';

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
 */
export async function agentReadiness(
  workspaceId: string,
  agent: Pick<
    Agent,
    'voiceEngine' | 'llmProvider' | 'appointmentBookingEnabled' | 'calendarIntegrationId' | 'transferEnabled' | 'transferNumber'
  > & { id?: string },
): Promise<ReadinessItem[]> {
  const creds = await prisma.aiCredential.findMany({ where: { workspaceId }, select: { provider: true } });
  const has = (p: string) => creds.some((c) => c.provider === p);
  const numbers = agent.id
    ? await prisma.phoneNumber.count({ where: { workspaceId } })
    : 0;

  const items: ReadinessItem[] = [];
  if (agent.voiceEngine === 'REALTIME') {
    items.push({ key: 'openai', label: 'Add your OpenAI API key', ok: has('OPENAI'), blocking: true });
  } else {
    const label = { OPENAI: 'OpenAI', ANTHROPIC: 'Claude', GEMINI: 'Gemini' }[agent.llmProvider];
    items.push({ key: 'llm', label: `Add your ${label} API key`, ok: has(agent.llmProvider), blocking: true });
    items.push({ key: 'deepgram', label: 'Add your Deepgram key for speech', ok: has('DEEPGRAM'), blocking: true });
  }
  items.push({ key: 'number', label: 'Connect a phone number', ok: numbers > 0, blocking: false });
  if (agent.appointmentBookingEnabled) {
    items.push({
      key: 'calendar',
      label: 'Link a Google Calendar for bookings',
      ok: !!agent.calendarIntegrationId,
      blocking: false,
    });
  }
  if (agent.transferEnabled) {
    items.push({ key: 'transfer', label: 'Set a transfer number', ok: !!agent.transferNumber, blocking: true });
  }
  return items;
}
