import type { Agent, Call, CampaignContact, Workspace } from '@prisma/client';
import { describe, isValidTimeZone } from './time';

/** Replaces {{name}}, {{company}} and any CSV column {{field}} with the contact's values. */
export function fillVariables(text: string, vars: Record<string, string>): string {
  return text.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_m, key: string) => vars[key.toLowerCase()] ?? '',
  );
}

export function contactVariables(
  contact: CampaignContact | null,
  call: Pick<Call, 'direction' | 'fromNumber' | 'toNumber'>,
) {
  const fields = (contact?.fields as Record<string, unknown> | null) ?? {};
  const vars: Record<string, string> = {
    name: contact?.name ?? '',
    first_name: contact?.name?.split(' ')[0] ?? '',
    company: contact?.company ?? '',
    email: contact?.email ?? '',
    phone: call.direction === 'OUTBOUND' ? call.toNumber : call.fromNumber,
  };
  for (const [k, v] of Object.entries(fields)) vars[k.toLowerCase()] = String(v ?? '');
  return vars;
}

/**
 * The full instruction set an agent runs a call with: the subscriber's own
 * prompt first (it defines the persona and the pitch), then the call
 * context, then the platform's rules for speaking on the phone.
 */
export function buildInstructions(input: {
  agent: Agent;
  workspace: Pick<Workspace, 'name'>;
  call: Pick<Call, 'direction' | 'fromNumber' | 'toNumber'>;
  contact: CampaignContact | null;
  campaignGoal?: string | null;
  toolNames: string[];
}): { instructions: string; greeting: string } {
  const { agent, workspace, call, contact } = input;
  const vars = contactVariables(contact, call);
  const tz = isValidTimeZone(agent.timezone) ? agent.timezone : 'UTC';
  const goal = [agent.goal, input.campaignGoal].filter(Boolean).join(' ');
  const greeting = fillVariables(agent.greeting, vars).trim();

  const sections = [
    fillVariables(agent.systemPrompt, vars),
    goal && `## Goal of this call\n${goal}`,
    agent.knowledge && `## Reference knowledge\n${fillVariables(agent.knowledge, vars)}`,
    `## This call\n` +
      [
        call.direction === 'OUTBOUND'
          ? `You are calling ${vars.name || 'a prospect'}${vars.company ? ` from ${vars.company}` : ''} at ${vars.phone}.`
          : `${vars.phone} is calling in.`,
        `You represent ${workspace.name}.`,
        `It is now ${describe(new Date(), tz)} (${tz}).`,
        greeting && `You have already opened the call by saying: "${greeting}"`,
        ...Object.entries(vars)
          .filter(([k, v]) => v && !['name', 'first_name', 'company', 'phone'].includes(k))
          .map(([k, v]) => `${k}: ${v}`),
      ]
        .filter(Boolean)
        .join('\n'),
    `## Speaking on the phone\n` +
      [
        '- This is a live phone call. Reply in one to three short, natural spoken sentences.',
        '- Never use lists, markdown, emojis, URLs or symbols; spell out numbers the way people say them.',
        '- Ask one question at a time, then stop and listen.',
        `- Speak in ${agent.language}. If the person switches language, follow them if you can.`,
        `- If asked, say honestly that you are an AI assistant calling on behalf of ${workspace.name}.`,
        '- If the person asks not to be called again, apologise, confirm they will not be contacted, then end the call.',
        '- If you reach voicemail or an answering machine, leave no message and end the call.',
      ].join('\n'),
    input.toolNames.length &&
      `## Actions\n` +
        [
          input.toolNames.includes('check_availability') &&
            '- Before suggesting meeting times, call check_availability. Offer at most two or three options. Book with book_appointment once they agree, then confirm the day and time back to them.',
          input.toolNames.includes('transfer_call') &&
            '- If they ask for a person or need something you cannot answer, say you are connecting them, then call transfer_call.',
          '- When the conversation is finished, say a short goodbye and then call end_call.',
        ]
          .filter(Boolean)
          .join('\n'),
  ];
  return { instructions: sections.filter(Boolean).join('\n\n'), greeting };
}
