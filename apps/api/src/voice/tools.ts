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
  send_email: z.object({
    to: z.string().trim().email().max(254),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(5000),
  }),
  send_whatsapp: z.object({
    to: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional()
      .or(z.literal('')),
    message: z.string().trim().min(1).max(1500),
  }),
};
export type ToolName = keyof typeof TOOL_SCHEMAS;

/** Messaging the workspace has connected; an agent's email/WhatsApp tools need them. */
export interface MessagingChannels {
  email: boolean;
  whatsapp: boolean;
}

export function toolsForAgent(
  agent: Pick<Agent, 'appointmentBookingEnabled' | 'transferEnabled' | 'transferNumber'> &
    Partial<Pick<Agent, 'emailEnabled' | 'whatsappEnabled'>>,
  channels: MessagingChannels = { email: true, whatsapp: true },
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
  if (agent.emailEnabled && channels.email) {
    tools.push({
      name: 'send_email',
      description:
        'Email the person information they asked for (or agreed to receive), e.g. a link, prices or details from the information you may send. Before calling, read their email address back to them and get a clear yes.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Their email address, exactly as confirmed.' },
          subject: { type: 'string', description: 'A short, specific subject line.' },
          message: {
            type: 'string',
            description:
              'The email body in plain text: a greeting, the information they asked for, and a sign-off with your name and the business name. No made-up facts.',
          },
        },
        required: ['to', 'subject', 'message'],
        additionalProperties: false,
      },
      schema: TOOL_SCHEMAS.send_email,
    });
  }
  if (agent.whatsappEnabled && channels.whatsapp) {
    tools.push({
      name: 'send_whatsapp',
      description:
        'Send the person a WhatsApp message with information they asked for (or agreed to receive). It goes to the number on this call unless they give another one.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description:
              'Only if they want it on a different number: international format, e.g. +14155550123. Leave empty for the number on this call.',
          },
          message: {
            type: 'string',
            description:
              'The message text: short, friendly, with the information or link they asked for.',
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
      schema: TOOL_SCHEMAS.send_whatsapp,
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
