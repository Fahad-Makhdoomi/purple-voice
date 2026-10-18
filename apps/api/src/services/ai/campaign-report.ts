import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { FOLLOW_UP_SEGMENTS, FOLLOW_UP_SEGMENT_INFO, summaryModelForEngine } from '@pv/shared';
import { logger } from '../../lib/logger';
import { badRequest } from '../../lib/http-error';
import { findApiKey } from '../ai-keys';
import { getAiSettings } from '../ai-settings';
import { Anthropic, claudeClient, claudeExtras } from './claude';
import type { CampaignAnalytics } from '../campaign-analytics';

export interface DigestInput {
  campaign: {
    name: string;
    status: string;
    goal: string;
    timezone: string;
    callWindowStart: string;
    callWindowEnd: string;
    maxAttempts: number;
    retryDelayMinutes: number;
    retryStrategy: string;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  agent: { name: string; goal: string; systemPrompt: string; greeting: string } | null;
  analytics: CampaignAnalytics;
  /** Call summaries written after each call, with the outcome and sentiment they got. */
  samples: Array<{
    outcome: string | null;
    sentiment: number | null;
    durationSec: number;
    summary: string;
  }>;
}

export const reportSchema = z.object({
  headline: z.string(),
  verdict: z.enum(['strong', 'mixed', 'weak']),
  whatWorked: z.array(z.string()),
  whatToImprove: z.array(z.string()),
  objections: z.array(z.object({ theme: z.string(), detail: z.string() })),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  followUps: z.array(z.object({ segment: z.enum(FOLLOW_UP_SEGMENTS), reason: z.string() })),
  scriptTweaks: z.array(z.string()),
});
export type CampaignReport = z.infer<typeof reportSchema>;

const str = { type: 'string' } as const;
const list = (items: object) => ({ type: 'array', items }) as const;
const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'headline',
    'verdict',
    'whatWorked',
    'whatToImprove',
    'objections',
    'recommendations',
    'followUps',
    'scriptTweaks',
  ],
  properties: {
    headline: { ...str, description: 'One sentence: how the campaign went and the main lesson.' },
    verdict: { type: 'string', enum: ['strong', 'mixed', 'weak'] },
    whatWorked: list(str),
    whatToImprove: list(str),
    objections: list({
      type: 'object',
      additionalProperties: false,
      required: ['theme', 'detail'],
      properties: { theme: str, detail: str },
    }),
    recommendations: list({
      type: 'object',
      additionalProperties: false,
      required: ['title', 'detail', 'priority'],
      properties: {
        title: str,
        detail: str,
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    }),
    followUps: list({
      type: 'object',
      additionalProperties: false,
      required: ['segment', 'reason'],
      properties: { segment: { type: 'string', enum: [...FOLLOW_UP_SEGMENTS] }, reason: str },
    }),
    scriptTweaks: list(str),
  },
} as const;

const SYSTEM = `You are a sales operations analyst reviewing a finished outbound calling campaign run by an AI voice agent.
You get the campaign settings, its measured results, the agent's own script and a sample of call summaries.
Be specific and honest: tie every point to a number or to something said on the calls. Never invent figures, quotes or customer details that are not in the data. Small samples (under ~30 calls) deserve cautious wording.
- whatWorked / whatToImprove: 2–5 short points each.
- objections: the recurring reasons people declined or hesitated, as seen in the call summaries. Empty if the data shows none.
- recommendations: concrete changes to the script, timing (call hours or days), retry settings, targeting or the offer, most valuable first (3–6).
- followUps: which of these groups are worth a follow-up campaign and why: ${FOLLOW_UP_SEGMENTS.map((s) => `${s} (${FOLLOW_UP_SEGMENT_INFO[s].label})`).join('; ')}. Only groups that have contacts.
- scriptTweaks: exact wording changes for the agent's opening, questions or objection handling (0–4).`;

const fmt = (n: number | null, unit = '') => (n === null ? 'n/a' : `${n}${unit}`);

/**
 * The campaign as plain text: numbers first, then the call summaries. It is the
 * prompt of the built-in AI analysis and also downloadable, so the same
 * digest can be pasted into any assistant.
 */
export function buildCampaignDigest(d: DigestInput): string {
  const { campaign: c, analytics: a } = d;
  const lines: string[] = [];
  lines.push(`# Campaign report: ${c.name}`, '');
  lines.push(
    `Status: ${c.status}. Goal: ${c.goal || 'not set'}.`,
    `Calling window ${c.callWindowStart}–${c.callWindowEnd} (${c.timezone}); up to ${c.maxAttempts} attempts per contact (retries ${c.retryStrategy.toLowerCase().replace(/_/g, ' ')}), at least ${c.retryDelayMinutes} min apart.`,
    `Ran ${c.startedAt ? c.startedAt.toISOString().slice(0, 10) : '?'} to ${c.completedAt ? c.completedAt.toISOString().slice(0, 10) : 'now'}.`,
    '',
  );
  if (d.agent) {
    lines.push(
      '## Agent',
      `Name: ${d.agent.name}. Goal: ${d.agent.goal || 'not set'}.`,
      `Opening line: ${d.agent.greeting || '(default)'}`,
      'Script:',
      d.agent.systemPrompt.slice(0, 3000),
      '',
    );
  }
  lines.push(
    '## Results',
    `Contacts on the list: ${a.totals.contacts}; called: ${a.totals.called}; spoke to a person: ${a.totals.reached} (${fmt(a.rates.contactRate, '%')} of those called).`,
    `Calls placed: ${a.totals.calls}; answered: ${a.totals.answeredCalls} (${fmt(a.rates.answerRate, '%')}); billed minutes: ${a.totals.minutes}; average answered call: ${a.totals.avgDurationSec}s.`,
    `Positive result (interested, callback, transfer or appointment): ${fmt(a.rates.positiveRate, '%')} of people reached. Appointments: ${fmt(a.rates.appointmentRate, '%')}.`,
    `Average sentiment (-1 to 1): ${fmt(a.totals.avgSentiment)}; positive/neutral/negative calls: ${a.sentiment.positive}/${a.sentiment.neutral}/${a.sentiment.negative}.`,
    '',
    '### Call outcomes',
    ...Object.entries(a.outcomes).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '### Contact status at the end',
    ...Object.entries(a.contactStatuses).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `### Calls and answers by hour (${c.timezone})`,
    ...a.byHour.map(
      (h) =>
        `- ${String(h.hour).padStart(2, '0')}:00 — ${h.calls} calls, ${h.answered} reached a person`,
    ),
    '',
    '### Numbers never reached',
    `${a.notReached.total} in all (${a.notReached.waitingRetry} still waiting for a retry): ` +
      Object.entries(a.notReached.byReason)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.toLowerCase().replace(/_/g, ' ')} ${v}`)
        .join(', '),
    '',
    '### Attempts needed',
    ...a.attempts.map(
      (r) => `- ${r.attempts} call(s): ${r.contacts} contacts, ${r.reached} reached`,
    ),
    '',
    '### Groups for follow-up',
    ...FOLLOW_UP_SEGMENTS.map(
      (s) => `- ${s} (${FOLLOW_UP_SEGMENT_INFO[s].label}): ${a.segments[s]}`,
    ),
    '',
  );
  if (d.samples.length) {
    lines.push('## Call summaries (sample)');
    for (const s of d.samples) {
      lines.push(
        `- [${s.outcome ?? 'no outcome'}, sentiment ${fmt(s.sentiment)}, ${s.durationSec}s] ${s.summary.replace(/\s+/g, ' ').slice(0, 450)}`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * Asks the vendor of the workspace's AI layer, with the key its calls use, to
 * analyse the digest. Throws a user-facing error when no key is available or
 * the vendor fails (unlike call summaries, the user is waiting on this).
 */
export async function generateCampaignReport(
  workspaceId: string,
  digest: string,
): Promise<CampaignReport> {
  const settings = await getAiSettings(workspaceId);
  const { provider, model } = summaryModelForEngine(
    settings.voiceEngine,
    settings.llmProvider,
    settings.model,
  );
  const apiKey = await findApiKey(workspaceId, provider);
  if (!apiKey)
    throw badRequest('AI analysis is not set up for your workspace yet. Contact support.');

  try {
    if (provider === 'ANTHROPIC') {
      const client = claudeClient(apiKey);
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: 'user', content: digest }],
        ...claudeExtras(model, 'medium', { type: 'json_schema', schema: JSON_SCHEMA }),
      });
      if (response.stop_reason === 'refusal') throw new Error('The model declined the request');
      const text = response.content.find(
        (b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text',
      )?.text;
      if (!text) throw new Error('Empty response');
      return reportSchema.parse(JSON.parse(text));
    }

    if (provider === 'OPENAI') {
      const client = new OpenAI({ apiKey, timeout: 120_000 });
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: digest },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'campaign_report',
            strict: true,
            schema: JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      });
      const text = completion.choices[0]?.message.content;
      if (!text) throw new Error('Empty response');
      return reportSchema.parse(JSON.parse(text));
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: digest,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: JSON_SCHEMA,
      },
    });
    if (!result.text) throw new Error('Empty response');
    return reportSchema.parse(JSON.parse(result.text));
  } catch (err) {
    logger.warn({ err, workspaceId }, 'Campaign report failed');
    throw badRequest('The AI analysis could not be completed. Try again in a moment.');
  }
}
