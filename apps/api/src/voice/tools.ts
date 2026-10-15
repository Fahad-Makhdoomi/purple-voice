import { z } from 'zod';
import type { Agent } from '@prisma/client';

/**
 * The actions an agent can take mid-call, defined once and translated to
 * each model vendor's tool format by the engines. Inputs are validated with
 * the zod schema before anything runs, whatever the vendor sent.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
  schema: z.ZodTypeAny;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const TOOL_SCHEMAS = {
  check_availability: z.object({ date }),
  book_appointment: z.object({
    start: localDateTime,
    name: z.string().min(1).max(160),
    email: z.string().email().max(254).optional().or(z.literal('')),
    notes: z.string().max(1000).optional(),
  }),
  transfer_call: z.object({ reason: z.string().max(300) }),
  end_call: z.object({ reason: z.string().max(300) }),
};
export type ToolName = keyof typeof TOOL_SCHEMAS;

export function toolsForAgent(
  agent: Pick<Agent, 'appointmentBookingEnabled' | 'transferEnabled' | 'transferNumber'>,
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (agent.appointmentBookingEnabled) {
    tools.push(
      {
        name: 'check_availability',
        description:
          'List open appointment slots on a given day in the business time zone. Call this before proposing times.',
        parameters: {
          type: 'object',
          properties: { date: { type: 'string', description: 'Day to check, YYYY-MM-DD.' } },
          required: ['date'],
          additionalProperties: false,
        },
        schema: TOOL_SCHEMAS.check_availability,
      },
      {
        name: 'book_appointment',
        description:
          'Book a confirmed appointment. Only call after the person has agreed to a specific open slot and you have their name.',
        parameters: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              description:
                'Slot start in the business time zone, YYYY-MM-DDTHH:mm, exactly as returned by check_availability.',
            },
            name: { type: 'string', description: "The person's full name." },
            email: {
              type: 'string',
              description: 'Email for the calendar invite, if they gave one.',
            },
            notes: {
              type: 'string',
              description: 'Anything the team should know before the meeting.',
            },
          },
          required: ['start', 'name'],
          additionalProperties: false,
        },
        schema: TOOL_SCHEMAS.book_appointment,
      },
    );
  }
  if (agent.transferEnabled && agent.transferNumber) {
    tools.push({
      name: 'transfer_call',
      description:
        'Transfer the call to a human on the team. Use when the person asks for a human, or is ready to buy and needs details you cannot give. Tell them you are connecting them first.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred.' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
      schema: TOOL_SCHEMAS.transfer_call,
    });
  }
  tools.push({
    name: 'end_call',
    description:
      'Hang up. Use after saying goodbye, when the person asks to end the call, asks not to be called again, or you reached voicemail or a wrong number.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why the call is ending.' } },
      required: ['reason'],
      additionalProperties: false,
    },
    schema: TOOL_SCHEMAS.end_call,
  });
  return tools;
}

/** Runs a tool call coming from any engine; returns the text the model sees as the result. */
export type ToolExecutor = (name: string, rawInput: unknown) => Promise<string>;
