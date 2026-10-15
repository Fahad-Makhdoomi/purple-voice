import { PLAN_CATALOG, formatPrice } from '@pv/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/http-error';
import { getEntitlements, getUsage } from '../entitlements';
import { Anthropic, claudeExtras } from './claude';

/**
 * The in-dashboard AI support assistant (Pro). Runs on the platform's own
 * Claude key, not the subscriber's. The stable product guide is cached as a
 * prompt prefix; the workspace snapshot follows it so it can change per
 * request without invalidating the cache.
 */

const PRODUCT_GUIDE = `You are the Purple Voice support assistant inside a customer's dashboard.
Purple Voice lets businesses build AI voice agents that make and answer sales calls over their own phone numbers.

How the product works:
- Integrations → AI keys: the customer brings their own API keys. OpenAI powers the Realtime engine (speech-to-speech, lowest latency). The Cascaded engine works with OpenAI, Claude or Gemini and needs a Deepgram key for speech-to-text and text-to-speech.
- Phone numbers: connect a Twilio or Plivo account (Account SID + Auth Token, or Auth ID + Auth Token), then pick a number. Purple Voice points the number's voice webhook at its servers automatically. Number rental is billed by the carrier, not Purple Voice. SuperPhone accounts can be saved but cannot place AI calls yet.
- Agents: name, engine, model, voice, language, a system prompt describing who the agent is and how it sells, a greeting, a goal, and knowledge (product facts, pricing, objection handling). Optional: live call transfer to a human number, appointment booking into Google Calendar. An agent must be Active to take calls.
- Campaigns: an agent + a caller number + a contact list (CSV with a "phone" column; extra columns become {{variables}} the agent can use). Calls happen inside the campaign's call window and days, with retries for no-answers.
- Calls: every call has a transcript, an AI summary, an outcome and a sentiment score.
- Pro adds webhooks (signed with HMAC-SHA256 in the X-PurpleVoice-Signature header), a developer API (Bearer pv_live_… keys), automations, detailed insights, priority support and this assistant.

Plans: Basic ${formatPrice(PLAN_CATALOG.BASIC.priceMonthlyCents)}/month (1 agent, 1 number, 1 campaign, 100 contacts per campaign, ${PLAN_CATALOG.BASIC.includedMinutes} minutes). Pro ${formatPrice(PLAN_CATALOG.PRO.priceMonthlyCents)}/month (unlimited agents, numbers and campaigns, ${PLAN_CATALOG.PRO.includedMinutes} minutes). Enterprise is custom — contact sales.

When helping write agent prompts: keep them in second person ("You are…"), state the goal, the offer, qualification questions, how to handle the top objections, when to transfer or book, and how to end politely. Calls are spoken, so prefer short sentences and no lists or markdown in what the agent says.

Be concise and practical. If something needs a human (billing disputes, bugs, outages), tell the customer to open a support ticket from the Support page. Never ask for or repeat API keys or passwords.`;

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function workspaceSnapshot(workspaceId: string): Promise<string> {
  const ent = await getEntitlements(workspaceId);
  const [usage, agents, creds, numbers] = await Promise.all([
    getUsage(workspaceId, ent),
    prisma.agent.findMany({ where: { workspaceId }, select: { name: true, status: true, voiceEngine: true, llmProvider: true } }),
    prisma.aiCredential.findMany({ where: { workspaceId }, select: { provider: true } }),
    prisma.phoneNumber.findMany({ where: { workspaceId }, select: { e164: true, routingConfigured: true, routingError: true } }),
  ]);
  return [
    `Customer workspace right now:`,
    `- Plan: ${ent.planName ?? 'none'} (${ent.status ?? 'no subscription'})`,
    `- Minutes used this period: ${usage.minutesUsed} of ${ent.includedMinutes ?? 'custom'}`,
    `- AI keys connected: ${creds.map((c) => c.provider).join(', ') || 'none'}`,
    `- Numbers: ${numbers.map((n) => `${n.e164}${n.routingConfigured ? '' : ` (routing problem: ${n.routingError ?? 'not configured'})`}`).join('; ') || 'none'}`,
    `- Agents: ${agents.map((a) => `${a.name} [${a.status}, ${a.voiceEngine}, ${a.llmProvider}]`).join('; ') || 'none'}`,
  ].join('\n');
}

export async function streamAssistantReply(
  workspaceId: string,
  messages: AssistantMessage[],
  onText: (delta: string) => void,
): Promise<{ refused: boolean }> {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'The AI assistant is not configured', 'assistant_unavailable');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.ASSISTANT_MODEL;

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    system: [
      { type: 'text', text: PRODUCT_GUIDE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: await workspaceSnapshot(workspaceId) },
    ],
    messages,
    ...claudeExtras(model, 'low'),
  });
  stream.on('text', onText);
  const final = await stream.finalMessage();
  return { refused: final.stop_reason === 'refusal' };
}
