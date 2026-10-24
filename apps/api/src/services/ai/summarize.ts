import OpenAI from 'openai';
import { sarvamChatClient } from './sarvam-client';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { CALL_OUTCOMES, summaryModelForEngine } from '@pv/shared';
import type { Agent } from '@prisma/client';
import { logger } from '../../lib/logger';
import { findApiKey } from '../ai-keys';
import { getAiSettings } from '../ai-settings';
import { Anthropic, claudeClient, claudeExtras } from './claude';

export interface TranscriptLine {
  role: 'agent' | 'caller' | 'system';
  text: string;
  at: string;
}

const summarySchema = z.object({
  summary: z.string(),
  outcome: z.enum(CALL_OUTCOMES),
  sentiment: z.number().min(-1).max(1),
  followUp: z.string(),
});
export type CallSummary = z.infer<typeof summarySchema>;

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'outcome', 'sentiment', 'followUp'],
  properties: {
    summary: {
      type: 'string',
      description: '2–4 sentence summary of the call for a sales manager.',
    },
    outcome: { type: 'string', enum: [...CALL_OUTCOMES] },
    sentiment: {
      type: 'number',
      description: "Caller's sentiment from -1 (hostile) to 1 (enthusiastic).",
    },
    followUp: {
      type: 'string',
      description: 'The single most useful next step, or an empty string.',
    },
  },
} as const;

const SYSTEM = `You review phone calls made by an AI sales agent and write the record a sales manager reads afterwards.
Be factual and specific: names, objections, prices quoted, commitments made. Never invent details that are not in the transcript.
Outcome guide: APPOINTMENT_BOOKED when a meeting time was confirmed; CALLBACK_REQUESTED when the caller asked to be called later; DO_NOT_CALL when they asked not to be contacted again; VOICEMAIL when only a machine answered; WRONG_NUMBER when the person is not the intended contact; TRANSFERRED when the call was handed to a human; otherwise INTERESTED, NOT_INTERESTED or OTHER.`;

function renderTranscript(lines: TranscriptLine[]): string {
  return lines
    .filter((l) => l.role !== 'system')
    .map((l) => `${l.role === 'agent' ? 'Agent' : 'Caller'}: ${l.text}`)
    .join('\n');
}

/**
 * Summarises a finished call with the vendor of the workspace's AI layer (the
 * one staff chose), using the same key its calls use. Speech-to-speech engines
 * summarise on a text model of their vendor. Returns null when the call is too
 * short to be worth it or the vendor fails; a missing summary never blocks call
 * finalisation.
 */
export async function summarizeCall(
  workspaceId: string,
  agent: Pick<Agent, 'goal'>,
  transcript: TranscriptLine[],
): Promise<CallSummary | null> {
  const spoken = transcript.filter((l) => l.role !== 'system');
  if (spoken.length < 2) return null;
  const prompt = `Call goal: ${agent.goal || 'not specified'}\n\nTranscript:\n${renderTranscript(spoken)}`;

  try {
    const settings = await getAiSettings(workspaceId);
    const { provider, model } = summaryModelForEngine(
      settings.voiceEngine,
      settings.llmProvider,
      settings.model,
    );
    const apiKey = await findApiKey(workspaceId, provider);
    if (!apiKey) return null;

    if (provider === 'ANTHROPIC') {
      const client = claudeClient(apiKey);
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        ...claudeExtras(model, 'medium', { type: 'json_schema', schema: JSON_SCHEMA }),
      });
      if (response.stop_reason === 'refusal') {
        logger.warn({ workspaceId }, 'Claude declined to summarise a call');
        return null;
      }
      const text = response.content.find(
        (b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text',
      )?.text;
      return text ? summarySchema.parse(JSON.parse(text)) : null;
    }

    if (provider === 'OPENAI' || provider === 'SARVAM') {
      const client =
        provider === 'SARVAM'
          ? sarvamChatClient(apiKey, 60_000)
          : new OpenAI({ apiKey, timeout: 60_000 });
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'call_summary',
            strict: true,
            schema: JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      });
      const text = completion.choices[0]?.message.content;
      return text ? summarySchema.parse(JSON.parse(text)) : null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: JSON_SCHEMA,
      },
    });
    return result.text ? summarySchema.parse(JSON.parse(result.text)) : null;
  } catch (err) {
    logger.warn({ err, workspaceId }, 'Call summary failed');
    return null;
  }
}
