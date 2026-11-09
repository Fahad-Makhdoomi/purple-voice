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
  if (!env.googleEnabled)
    throw new HttpError(503, 'Google Calendar is not configured on this server');
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

/**
 * Swaps an OAuth authorization code at Google's token endpoint. Shared by the
 * Calendar connection and "Continue with Google"; `redirectUri` must be the
 * one the consent screen was opened with.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<{ tokens: GoogleTokens; idToken: string | null }> {
  const json = await tokenRequest({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  return {
    tokens: {
      accessToken: json.access_token!,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    },
    idToken: json.id_token ?? null,
  };
}

/**
 * The claims of an id_token, without checking its signature. Only safe for a
 * token received directly from Google's token endpoint over TLS (OIDC Core
 * 3.1.3.7); returns null when it isn't a well-formed JWT.
 */
export function decodeIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Calendar connection: tokens to store, plus the account's email as a label. */
export async function exchangeCode(
  code: string,
): Promise<{ tokens: GoogleTokens; email: string | null }> {
  const { tokens, idToken } = await exchangeGoogleCode(code, googleRedirectUri());
  const email = idToken ? decodeIdTokenPayload(idToken)?.email : null;
  return { tokens, email: typeof email === 'string' ? email : null };
}

async function accessToken(integration: Integration): Promise<string> {
  if (!integration.secretsEnc) throw new HttpError(400, 'Google Calendar is not connected');
  const tokens = decryptJson<GoogleTokens>(integration.secretsEnc);
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) throw new HttpError(400, 'Reconnect Google Calendar');

  const json = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
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

async function calendarFetch<T>(
  integration: Integration,
  path: string,
  body?: unknown,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const token = await accessToken(integration);
  const res = await fetch(`${CAL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  // DELETE answers 204 with no body.
  const json = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!res.ok) {
    const message = json.error?.message ?? `Google Calendar error ${res.status}`;
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastError: message },
    });
    throw new HttpError(502, message, 'google_calendar');
  }
  return json;
}

export async function busySlots(integration: Integration, from: Date, to: Date) {
  const json = await calendarFetch<{
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  }>(integration, '/freeBusy', {
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    items: [{ id: 'primary' }],
  });
  return json.calendars.primary?.busy ?? [];
}

export async function createEvent(
  integration: Integration,
  event: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    timeZone: string;
    location?: string;
    attendeeEmail?: string;
  },
) {
  return calendarFetch<{ id: string; htmlLink: string }>(
    integration,
    '/calendars/primary/events?sendUpdates=all',
    {
      ...eventBody(event),
      attendees: event.attendeeEmail ? [{ email: event.attendeeEmail }] : undefined,
    },
  );
}

function eventBody(event: {
  summary: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
  timeZone: string;
}) {
  return {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
    end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
  };
}

/** Moves or edits an event we created earlier. */
export async function updateEvent(
  integration: Integration,
  eventId: string,
  event: Parameters<typeof eventBody>[0],
) {
  return calendarFetch<{ id: string; htmlLink: string }>(
    integration,
    `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    eventBody(event),
    'PATCH',
  );
}

/** Removes an event we created earlier (an already-deleted event is fine). */
export async function deleteEvent(integration: Integration, eventId: string) {
  try {
    await calendarFetch(
      integration,
      `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      undefined,
      'DELETE',
    );
  } catch (err) {
    if (err instanceof HttpError && /not found|deleted|gone/i.test(err.message)) return;
    throw err;
  }
}

export interface GoogleBusyEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

/**
 * Events on the primary calendar that make the owner busy, for pulling into
 * the standalone calendar: skips cancelled, "free" (transparent) and declined ones.
 */
export async function listBusyEvents(
  integration: Integration,
  from: Date,
  to: Date,
): Promise<GoogleBusyEvent[]> {
  const out: GoogleBusyEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    if (pageToken) q.set('pageToken', pageToken);
    const json = await calendarFetch<{
      nextPageToken?: string;
      items?: Array<{
        id: string;
        status?: string;
        summary?: string;
        transparency?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        attendees?: Array<{ self?: boolean; responseStatus?: string }>;
      }>;
    }>(integration, `/calendars/primary/events?${q}`);
    for (const e of json.items ?? []) {
      if (e.status === 'cancelled' || e.transparency === 'transparent') continue;
      if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
      const start = e.start?.dateTime ?? e.start?.date;
      const end = e.end?.dateTime ?? e.end?.date;
      if (!start || !end) continue;
      out.push({
        id: e.id,
        title: e.summary ?? 'Busy',
        start: new Date(start),
        end: new Date(end),
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken && out.length < 1000);
  return out;
}
