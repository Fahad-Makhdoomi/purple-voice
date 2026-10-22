import crypto from 'node:crypto';
import express, { Router, type Request } from 'express';
import { inboundLeadSchema, parseTags } from '@pv/shared';
import type { CrmSettings } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { decrypt, decryptJson, safeEqual } from '../lib/crypto';
import { badRequest, forbidden, notFound } from '../lib/http-error';
import { toE164 } from '../lib/csv';
import { hookLimiter } from '../middleware/rate-limit';
import { addActivity, intakeLead } from '../services/crm';
import { sendAgentMessage, type WhatsappConfig } from '../services/messaging';
import type { TwilioCredentials } from '../telephony/types';

/**
 * Where new leads come in from outside, addressed by the workspace's CRM hook
 * token (Dashboard → CRM → Settings):
 *
 *   POST /api/hooks/leads/:token      website forms, Zapier, Make, Facebook lead ads
 *   GET  /api/hooks/whatsapp/:token   Meta's webhook verification
 *   POST /api/hooks/whatsapp/:token   incoming WhatsApp messages (Meta Cloud API or Twilio)
 *
 * Mounted before the JSON parser: signatures are checked on the raw body.
 */
export const hooksRouter = Router();
hooksRouter.use(hookLimiter, express.raw({ type: () => true, limit: '256kb' }));

interface IncomingMessage {
  /** +E.164. */
  from: string;
  name: string | null;
  text: string;
}

const LEAD_KEYS = new Set(Object.keys(inboundLeadSchema.shape));

async function settingsFor(token: string): Promise<CrmSettings> {
  const settings =
    token.length >= 16 && token.length <= 64
      ? await prisma.crmSettings.findUnique({ where: { hookToken: token } })
      : null;
  if (!settings) throw notFound('Webhook');
  return settings;
}

/** The body as fields, whether it came as JSON or as a form. */
function bodyFields(req: Request): Record<string, unknown> {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw.trim()) return {};
  if (req.is('application/x-www-form-urlencoded'))
    return Object.fromEntries(new URLSearchParams(raw));
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw badRequest('Send the lead as JSON or as a form');
  }
}

// ── Lead webhook ────────────────────────────────────────────────────────────

hooksRouter.post('/leads/:token', async (req, res) => {
  const settings = await settingsFor(String(req.params.token));
  const parsed = inboundLeadSchema.safeParse(bodyFields(req));
  if (!parsed.success) throw badRequest('Send at least a "phone" field');
  const input = parsed.data;
  const phone = toE164(input.phone);
  if (!phone) throw badRequest('Send the phone number with its country code, e.g. +14155550123');
  const name = input.name || [input.first_name, input.last_name].filter(Boolean).join(' ') || null;
  const extras = Object.fromEntries(
    Object.entries(input)
      .filter(([k, v]) => !LEAD_KEYS.has(k) && ['string', 'number', 'boolean'].includes(typeof v))
      .slice(0, 30)
      .map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 500)]),
  );
  const email = input.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ? input.email : null;
  const result = await intakeLead(
    settings.workspaceId,
    {
      phone,
      name,
      email: email?.toLowerCase() ?? null,
      company: input.company || null,
      notes: input.notes || input.message || null,
      tags: parseTags(input.tags),
      fields: Object.keys(extras).length ? extras : null,
    },
    'webhook',
    'New lead from the lead webhook',
  );
  if (!result) throw forbidden('The CRM is part of the Pro plan');
  res.status(result.created ? 201 : 200).json({
    ok: true,
    leadId: result.lead.id,
    created: result.created,
    callAt: result.callAt,
  });
});

// ── WhatsApp ────────────────────────────────────────────────────────────────

/** Meta checks the callback URL once with the verify token before sending anything. */
hooksRouter.get('/whatsapp/:token', async (req, res) => {
  const settings = await settingsFor(String(req.params.token));
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === settings.hookToken
  ) {
    res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
    return;
  }
  throw forbidden('Verification failed');
});

/** Messages in a Meta Cloud API webhook payload, for the given WhatsApp number id. */
export function parseMetaWebhook(body: unknown, phoneNumberId?: string): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] }).changes ?? []) {
      const value = (change as { value?: Record<string, unknown> }).value;
      if (!value) continue;
      const meta = value.metadata as { phone_number_id?: string } | undefined;
      if (phoneNumberId && meta?.phone_number_id && meta.phone_number_id !== phoneNumberId)
        continue;
      const contacts =
        (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) ?? [];
      for (const m of (value.messages as Array<Record<string, unknown>>) ?? []) {
        const from = toE164(`+${String(m.from ?? '')}`);
        if (!from) continue;
        const contact = contacts.find((c) => c.wa_id === m.from) ?? contacts[0];
        const text =
          (m.text as { body?: string } | undefined)?.body ??
          (m.button as { text?: string } | undefined)?.text ??
          ((m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } })
            ?.button_reply?.title ||
            (m.interactive as { list_reply?: { title?: string } })?.list_reply?.title) ??
          `[${String(m.type ?? 'message')}]`;
        out.push({ from, name: contact?.profile?.name?.trim() || null, text: text.slice(0, 2000) });
      }
    }
  }
  return out;
}

/** An incoming Twilio WhatsApp message (form fields From=whatsapp:+…, Body, ProfileName). */
export function parseTwilioWhatsapp(fields: Record<string, unknown>): IncomingMessage | null {
  const from = String(fields.From ?? '');
  if (!from.startsWith('whatsapp:')) return null;
  const phone = toE164(from.slice('whatsapp:'.length));
  if (!phone) return null;
  const media = Number(fields.NumMedia ?? 0);
  return {
    from: phone,
    name: String(fields.ProfileName ?? '').trim() || null,
    text: (String(fields.Body ?? '').trim() || (media ? '[media]' : '[message]')).slice(0, 2000),
  };
}

/** Twilio's request signature: HMAC-SHA1 of the URL and the sorted form fields. */
export function twilioSignature(authToken: string, url: string, fields: Record<string, string>) {
  const data = Object.keys(fields)
    .sort()
    .reduce((acc, key) => acc + key + fields[key], url);
  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function metaSignatureOk(appSecret: string, raw: Buffer, header: string | undefined) {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  return safeEqual(`sha256=${expected}`, header);
}

hooksRouter.post('/whatsapp/:token', async (req, res) => {
  const settings = await settingsFor(String(req.params.token));
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId: settings.workspaceId, type: 'WHATSAPP' } },
  });
  const config = integration?.config as WhatsappConfig | undefined;
  let messages: IncomingMessage[];

  if (req.is('application/x-www-form-urlencoded')) {
    // Twilio: always signed with the account's auth token.
    const fields = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    if (config?.provider !== 'TWILIO') throw forbidden('Connect Twilio WhatsApp first');
    const account = await prisma.telephonyAccount.findFirst({
      where: { id: config.telephonyAccountId, workspaceId: settings.workspaceId },
    });
    const creds = account ? decryptJson<TwilioCredentials>(account.credentialsEnc) : null;
    const url = `${env.publicApiUrl}/api/hooks/whatsapp/${settings.hookToken}`;
    const sig = req.header('x-twilio-signature') ?? '';
    if (!creds || !safeEqual(twilioSignature(creds.authToken, url, fields), sig))
      throw forbidden('Signature check failed');
    const message = parseTwilioWhatsapp(fields);
    messages = message ? [message] : [];
    res.type('text/xml').send('<Response></Response>');
  } else {
    // Meta: signed with the app secret when the subscriber gave us one.
    if (
      settings.metaAppSecretEnc &&
      !metaSignatureOk(decrypt(settings.metaAppSecretEnc), raw, req.header('x-hub-signature-256'))
    )
      throw forbidden('Signature check failed');
    let body: unknown = null;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      throw badRequest('Expected JSON');
    }
    messages = parseMetaWebhook(
      body,
      config?.provider === 'META' ? config.phoneNumberId : undefined,
    );
    res.send('EVENT_RECEIVED');
  }

  // Answered already: Meta and Twilio retry slow webhooks.
  for (const message of messages) {
    void handleWhatsapp(settings, message).catch((err) =>
      logger.warn({ err, workspaceId: settings.workspaceId }, 'WhatsApp lead failed'),
    );
  }
});

/**
 * A WhatsApp message: on the timeline of the lead it came from, or a new lead
 * (and its instant agent call and auto-reply) when the number isn't in the CRM.
 */
async function handleWhatsapp(settings: CrmSettings, message: IncomingMessage) {
  const { workspaceId } = settings;
  const existing = await prisma.crmLead.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: message.from } },
  });
  if (existing) {
    await addActivity(existing.id, 'whatsapp', `They wrote on WhatsApp: "${message.text}"`);
    return;
  }
  if (!settings.whatsappLeads) return;
  const result = await intakeLead(
    workspaceId,
    { phone: message.from, name: message.name, notes: `Wrote on WhatsApp: "${message.text}"` },
    'whatsapp',
    'New lead from WhatsApp',
  );
  if (!result?.created) return;
  await addActivity(result.lead.id, 'whatsapp', `They wrote on WhatsApp: "${message.text}"`);
  if (settings.whatsappReply.trim()) {
    const sent = await sendAgentMessage({
      workspaceId,
      channel: 'WHATSAPP',
      to: message.from,
      text: settings.whatsappReply.trim(),
    });
    await addActivity(
      result.lead.id,
      'whatsapp',
      sent.ok ? 'Auto-reply sent on WhatsApp' : `Auto-reply not sent: ${sent.detail}`,
    );
  }
}
