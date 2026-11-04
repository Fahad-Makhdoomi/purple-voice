import nodemailer from 'nodemailer';
import type { Prisma } from '@prisma/client';
import type { EmailSettingsInput, EmailSettingsView } from '@pv/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { decrypt, encrypt } from '../lib/crypto';
import { badRequest } from '../lib/http-error';

/**
 * The mail server for the platform's own email. A super admin sets it in
 * Super admin → Email (SMTP); it is kept in SiteSetting with the password
 * encrypted. Until then the SMTP_* environment variables are used, so
 * existing installs keep working.
 */

const KEY = 'email';
const TIMEOUT_MS = 15_000;
const CACHE_MS = 30_000;

interface Stored {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordEnc: string | null;
  from: string;
  supportEmails: string;
}

export interface MailServer {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

let cache: { at: number; value: MailServer | null; support: string } | null = null;

async function stored(): Promise<Stored | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const v = row?.value as Partial<Stored> | null | undefined;
  if (!v?.host) return null;
  return {
    host: v.host,
    port: v.port ?? 587,
    secure: v.secure ?? false,
    username: v.username ?? '',
    passwordEnc: v.passwordEnc ?? null,
    from: v.from ?? env.MAIL_FROM,
    supportEmails: v.supportEmails ?? '',
  };
}

/** The mail server to use now: the saved one, else the environment's, else none. */
export async function currentMailServer(): Promise<MailServer | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const s = await stored();
  let value: MailServer | null = null;
  let support = env.SUPPORT_NOTIFY_EMAILS ?? '';
  if (s) {
    value = {
      host: s.host,
      port: s.port,
      secure: s.secure,
      user: s.username || undefined,
      pass: s.passwordEnc ? decrypt(s.passwordEnc) : undefined,
      from: s.from,
    };
    support = s.supportEmails || support;
  } else if (env.SMTP_HOST) {
    value = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    };
  }
  cache = { at: Date.now(), value, support };
  return value;
}

/** Who is told about new support tickets. */
export async function supportNotifyEmails(): Promise<string[]> {
  await currentMailServer();
  return (cache?.support ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createTransport(s: MailServer) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    requireTLS: !s.secure && s.port !== 25 && s.port !== 1025,
    auth: s.user ? { user: s.user, pass: s.pass ?? '' } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

export async function emailSettingsView(): Promise<EmailSettingsView> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const s = await stored();
  if (s) {
    return {
      source: 'database',
      host: s.host,
      port: s.port,
      secure: s.secure,
      username: s.username,
      from: s.from,
      supportEmails: s.supportEmails,
      hasPassword: !!s.passwordEnc,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }
  return {
    source: env.SMTP_HOST ? 'environment' : 'none',
    host: env.SMTP_HOST ?? '',
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    username: env.SMTP_USER ?? '',
    from: env.MAIL_FROM,
    supportEmails: env.SUPPORT_NOTIFY_EMAILS ?? '',
    hasPassword: !!env.SMTP_PASSWORD,
    updatedAt: null,
  };
}

/** Logs in to the server first, so a wrong host or password is caught when it is saved. */
export async function saveEmailSettings(input: EmailSettingsInput): Promise<void> {
  const existing = await stored();
  const username = input.username ?? '';
  // A blank password keeps the saved one, but only for the same account.
  const passwordEnc = input.password
    ? encrypt(input.password)
    : existing && existing.username === username
      ? existing.passwordEnc
      : null;

  const server: MailServer = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    user: username || undefined,
    pass: passwordEnc ? decrypt(passwordEnc) : undefined,
    from: input.from,
  };
  const transport = createTransport(server);
  try {
    await transport.verify();
  } catch (err) {
    throw badRequest(`Could not sign in to ${input.host}: ${(err as Error).message}`);
  } finally {
    transport.close();
  }

  const value: Stored = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username,
    passwordEnc,
    from: input.from,
    supportEmails: input.supportEmails ?? '',
  };
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
  cache = null;
}

/** Back to the SMTP_* environment variables. */
export async function clearEmailSettings(): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key: KEY } });
  cache = null;
}
