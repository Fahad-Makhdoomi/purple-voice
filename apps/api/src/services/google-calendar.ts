import type { Integration } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { decryptJson, encryptJson } from '../lib/crypto';
import { HttpError } from '../lib/http-error';

/**
 * Google Calendar over its REST API with the workspace's OAuth tokens.
 * Used by agents to check availability and book meetings mid-call.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export function googleRedirectUri(): string {
  return `${env.publicApiUrl}/api/integrations/google/callback`;
}

export function googleAuthUrl(state: string): string {
  if (!env.googleEnabled) throw new HttpError(503, 'Google Calendar is not configured on this server');
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', googleRedirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', state);
  return u.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new HttpError(400, json.error_description ?? 'Google sign-in failed', 'google_oauth');
  }
  return json;
}

export async function exchangeCode(code: string): Promise<{ tokens: GoogleTokens; email: string | null }> {
  const json = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: googleRedirectUri() });
  let email: string | null = null;
  if (json.id_token) {
    try {
      email = JSON.parse(Buffer.from(json.id_token.split('.')[1] ?? '', 'base64url').toString('utf8')).email ?? null;
    } catch {
      email = null;
    }
  }
  return {
    tokens: {
      accessToken: json.access_token!,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    },
    email,
  };
}

async function accessToken(integration: Integration): Promise<string> {
  if (!integration.secretsEnc) throw new HttpError(400, 'Google Calendar is not connected');
  const tokens = decryptJson<GoogleTokens>(integration.secretsEnc);
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) throw new HttpError(400, 'Reconnect Google Calendar');

  const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
  const next: GoogleTokens = {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await prisma.integration.update({
    where: { id: integration.id },
    data: { secretsEnc: encryptJson(next), lastError: null },
  });
  return next.accessToken;
}

async function calendarFetch<T>(integration: Integration, path: string, body: unknown): Promise<T> {
  const token = await accessToken(integration);
  const res = await fetch(`${CAL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    const message = json.error?.message ?? `Google Calendar error ${res.status}`;
    await prisma.integration.update({ where: { id: integration.id }, data: { lastError: message } });
    throw new HttpError(502, message, 'google_calendar');
  }
  return json;
}

export async function busySlots(integration: Integration, from: Date, to: Date) {
  const json = await calendarFetch<{ calendars: Record<string, { busy: Array<{ start: string; end: string }> }> }>(
    integration,
    '/freeBusy',
    { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: 'primary' }] },
  );
  return json.calendars.primary?.busy ?? [];
}

export async function createEvent(
  integration: Integration,
  event: { summary: string; description: string; start: Date; end: Date; timeZone: string; attendeeEmail?: string },
) {
  return calendarFetch<{ id: string; htmlLink: string }>(integration, '/calendars/primary/events?sendUpdates=all', {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
    end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
    attendees: event.attendeeEmail ? [{ email: event.attendeeEmail }] : undefined,
  });
}
