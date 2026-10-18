import nodemailer from 'nodemailer';
import type { Integration, MessageChannel } from '@prisma/client';
import type { SmtpIntegrationInput, WhatsappIntegrationInput } from '@pv/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { decryptJson } from '../lib/crypto';
import { badRequest } from '../lib/http-error';
import { resolvePublicHost } from '../lib/ssrf';
import type { TwilioCredentials } from '../telephony/types';

/**
 * Messages agents send during calls: an email through the workspace's own
 * mail server (Integrations → Email) or a WhatsApp message through its
 * WhatsApp Business number (Integrations → WhatsApp). Every attempt is kept
 * as a CallMessage, sent or not, and shows on the call's page.
 */

/** What's saved in Integration.config (no secrets) for each channel. */
export type SmtpConfig = Omit<SmtpIntegrationInput, 'password'>;
export type WhatsappConfig =
  | (Omit<Extract<WhatsappIntegrationInput, { provider: 'META' }>, 'accessToken'> & {
      displayNumber?: string;
    })
  | Extract<WhatsappIntegrationInput, { provider: 'TWILIO' }>;

const TIMEOUT_MS = 15_000;

// ── Email ───────────────────────────────────────────────────────────────────

async function smtpTransport(config: SmtpConfig, password: string | undefined) {
  // Connect to the address we checked, and still verify the certificate for the name.
  const address = await resolvePublicHost(config.host);
  return nodemailer.createTransport({
    host: address,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && config.port !== 25,
    tls: { servername: config.host },
    auth: config.username ? { user: config.username, pass: password ?? '' } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

/** Logs in to the mail server, so a wrong host or password is caught when it is saved. */
export async function verifySmtp(config: SmtpConfig, password: string | undefined) {
  const transport = await smtpTransport(config, password);
  try {
    await transport.verify();
  } catch (err) {
    throw badRequest(`Could not sign in to ${config.host}: ${(err as Error).message}`);
  } finally {
    transport.close();
  }
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Plain text as simple HTML: paragraphs, line breaks and clickable https links. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p>${escapeHtml(p)
          .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
          .replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n');
}

async function sendEmailWith(
  integration: Integration,
  mail: { to: string; subject: string; text: string },
): Promise<string | undefined> {
  const config = integration.config as unknown as SmtpConfig;
  const { password } = integration.secretsEnc
    ? decryptJson<{ password?: string }>(integration.secretsEnc)
    : { password: undefined };
  const transport = await smtpTransport(config, password);
  try {
    const info = await transport.sendMail({
      from: config.fromName
        ? { name: config.fromName, address: config.fromEmail }
        : config.fromEmail,
      replyTo: config.replyTo || undefined,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: textToHtml(mail.text),
    });
    return info.messageId;
  } finally {
    transport.close();
  }
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

const graph = (path: string) => `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${path}`;

async function graphFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(graph(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    [k: string]: unknown;
  };
  if (!res.ok) throw new Error(body.error?.message ?? `WhatsApp returned ${res.status}`);
  return body;
}

async function twilioAccount(workspaceId: string, telephonyAccountId: string) {
  const account = await prisma.telephonyAccount.findFirst({
    where: { id: telephonyAccountId, workspaceId, provider: 'TWILIO' },
  });
  if (!account) throw badRequest('Choose one of your connected Twilio accounts');
  return decryptJson<TwilioCredentials>(account.credentialsEnc);
}

async function twilioMessage(creds: TwilioCredentials, form: Record<string, string>) {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Twilio returned ${res.status}`);
  return body.sid;
}

/**
 * Checks WhatsApp settings before saving. Returns the business number's
 * display form for Meta.
 */
export async function verifyWhatsapp(
  workspaceId: string,
  input: WhatsappIntegrationInput,
  savedToken?: string,
): Promise<{ displayNumber?: string }> {
  if (input.provider === 'META') {
    const token = input.accessToken || savedToken;
    if (!token) throw badRequest('Paste the access token from Meta');
    try {
      const info = await graphFetch(
        `${input.phoneNumberId}?fields=display_phone_number,verified_name`,
        token,
      );
      return { displayNumber: String(info.display_phone_number ?? '') || undefined };
    } catch (err) {
      throw badRequest(`WhatsApp did not accept those details: ${(err as Error).message}`);
    }
  }
  await twilioAccount(workspaceId, input.telephonyAccountId);
  return {};
}

const digits = (e164: string) => e164.replace(/\D/g, '');

async function sendWhatsappWith(
  integration: Integration,
  msg: { to: string; text: string },
): Promise<string | undefined> {
  const config = integration.config as unknown as WhatsappConfig;
  if (config.provider === 'META') {
    const { accessToken } = decryptJson<{ accessToken: string }>(integration.secretsEnc ?? '');
    const payload = config.templateName
      ? {
          messaging_product: 'whatsapp',
          to: digits(msg.to),
          type: 'template',
          template: {
            name: config.templateName,
            language: { code: config.templateLanguage || 'en_US' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: msg.text }] }],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: digits(msg.to),
          type: 'text',
          text: { body: msg.text, preview_url: true },
        };
    const res = await graphFetch(`${config.phoneNumberId}/messages`, accessToken, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (res.messages as Array<{ id?: string }> | undefined)?.[0]?.id;
  }
  const creds = await twilioAccount(integration.workspaceId, config.telephonyAccountId);
  return twilioMessage(creds, {
    From: `whatsapp:${config.from}`,
    To: `whatsapp:${msg.to}`,
    ...(config.contentSid
      ? { ContentSid: config.contentSid, ContentVariables: JSON.stringify({ 1: msg.text }) }
      : { Body: msg.text }),
  });
}

// ── Sending from a call ─────────────────────────────────────────────────────

/** Which messaging integrations a workspace has connected. */
export async function messagingChannels(workspaceId: string) {
  const rows = await prisma.integration.findMany({
    where: { workspaceId, type: { in: ['SMTP', 'WHATSAPP'] } },
    select: { type: true },
  });
  return {
    email: rows.some((r) => r.type === 'SMTP'),
    whatsapp: rows.some((r) => r.type === 'WHATSAPP'),
  };
}

export interface AgentMessage {
  workspaceId: string;
  callId?: string;
  agentId?: string;
  channel: MessageChannel;
  to: string;
  subject?: string;
  text: string;
}

/**
 * Sends one message and records it. Returns a sentence the agent (or the
 * dashboard) can relay; never throws for a delivery problem.
 */
export async function sendAgentMessage(m: AgentMessage): Promise<{ ok: boolean; detail: string }> {
  const type = m.channel === 'EMAIL' ? 'SMTP' : 'WHATSAPP';
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId: m.workspaceId, type } },
  });
  if (!integration) {
    return {
      ok: false,
      detail: `${m.channel === 'EMAIL' ? 'Email' : 'WhatsApp'} is not connected for this business.`,
    };
  }
  let providerMessageId: string | undefined;
  let error: string | null = null;
  try {
    providerMessageId =
      m.channel === 'EMAIL'
        ? await sendEmailWith(integration, { to: m.to, subject: m.subject ?? '', text: m.text })
        : await sendWhatsappWith(integration, { to: m.to, text: m.text });
  } catch (err) {
    error = (err as Error).message.slice(0, 500);
    logger.warn({ err, channel: m.channel, callId: m.callId }, 'Agent message failed');
    await prisma.integration.update({ where: { id: integration.id }, data: { lastError: error } });
  }
  await prisma.callMessage.create({
    data: {
      workspaceId: m.workspaceId,
      callId: m.callId,
      agentId: m.agentId,
      channel: m.channel,
      to: m.to,
      subject: m.subject,
      body: m.text,
      status: error ? 'failed' : 'sent',
      error,
      providerMessageId,
    },
  });
  if (!error && integration.lastError) {
    await prisma.integration.update({ where: { id: integration.id }, data: { lastError: null } });
  }
  return error ? { ok: false, detail: error } : { ok: true, detail: 'sent' };
}
