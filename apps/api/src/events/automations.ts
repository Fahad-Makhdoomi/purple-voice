import { z } from 'zod';
import { automationActionSchema, automationConditionSchema, type WebhookEvent } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { decryptJson } from '../lib/crypto';
import { sendMail } from '../lib/mailer';
import { assertPublicUrl } from '../lib/ssrf';

type Condition = z.infer<typeof automationConditionSchema>;
type Action = z.infer<typeof automationActionSchema>;

function matches(condition: Condition, data: Record<string, unknown>): boolean {
  const actual = data[condition.field];
  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'gt':
      return typeof actual === 'number' && actual > Number(condition.value);
    case 'lt':
      return typeof actual === 'number' && actual < Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(String(actual));
  }
}

async function runAction(
  workspaceId: string,
  action: Action,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  switch (action.type) {
    case 'webhook': {
      const url = await assertPublicUrl(action.url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PurpleVoice-Automations/1.0',
        },
        body: JSON.stringify({ event, data }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      return;
    }
    case 'email': {
      await sendMail({
        to: action.to,
        subject: action.subject,
        text: `Event: ${event}\n\n${Object.entries(data)
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join('\n')}`,
      });
      return;
    }
    case 'slack': {
      const integration = await prisma.integration.findFirst({
        where: { id: action.integrationId, workspaceId, type: 'SLACK' },
      });
      if (!integration?.secretsEnc) throw new Error('Slack is not connected');
      const { secret } = decryptJson<{ secret: string }>(integration.secretsEnc);
      const summary = typeof data.summary === 'string' ? data.summary : '';
      await fetch(await assertPublicUrl(secret), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${event}* ${data.toNumber ?? data.contactPhone ?? ''}\n${summary}`.trim(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return;
    }
    case 'add_to_campaign': {
      const phone = (data.direction === 'INBOUND' ? data.fromNumber : data.toNumber) as
        string | undefined;
      if (!phone) return;
      const campaign = await prisma.campaign.findFirst({
        where: { id: action.campaignId, workspaceId },
      });
      if (!campaign) throw new Error('Campaign not found');
      await prisma.campaignContact.upsert({
        where: { campaignId_phone: { campaignId: campaign.id, phone } },
        create: { campaignId: campaign.id, workspaceId, phone },
        update: {},
      });
      return;
    }
    case 'mark_do_not_call': {
      const contactId = data.contactId as string | undefined;
      if (contactId) {
        await prisma.campaignContact.updateMany({
          where: { id: contactId, workspaceId },
          data: { status: 'DO_NOT_CALL' },
        });
      }
      return;
    }
  }
}

/** Evaluates every active automation for this trigger. One failing rule never stops the others. */
export async function runAutomations(
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  const rules = await prisma.automation.findMany({
    where: { workspaceId, trigger: event, active: true },
  });
  for (const rule of rules) {
    const conditions = z.array(automationConditionSchema).safeParse(rule.conditions);
    const actions = z.array(automationActionSchema).safeParse(rule.actions);
    if (!conditions.success || !actions.success) continue;
    if (!conditions.data.every((c) => matches(c, data))) continue;

    let lastError: string | null = null;
    for (const action of actions.data) {
      try {
        await runAction(workspaceId, action, event, data);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(
          { err, automationId: rule.id, action: action.type },
          'Automation action failed',
        );
      }
    }
    await prisma.automation.update({
      where: { id: rule.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date(), lastError },
    });
  }
}
