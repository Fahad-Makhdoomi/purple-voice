import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { decrypt, encrypt } from '../lib/crypto';
import { badRequest, HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

/**
 * Google Search Console: how the site performs in Google Search (queries,
 * ranking pages, clicks, impressions, CTR, average position), sitemap status
 * and per-URL index inspection.
 *
 * Connected with a Google Cloud service account: a super admin pastes its
 * JSON key and adds the service account's email as a user on the Search
 * Console property. The private key is stored AES-256-GCM encrypted in
 * SiteSetting "searchConsole" and never leaves the API. Read-only scope.
 */

const KEY = 'searchConsole';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://searchconsole.googleapis.com';
const TIMEOUT_MS = 20_000;
const CACHE_MS = 60 * 60 * 1000;

interface Stored {
  siteUrl: string;
  clientEmail: string;
  privateKeyEnc: string;
  connectedAt: string;
}

export const searchConsoleInputSchema = z.object({
  siteUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => /^sc-domain:[a-z0-9.-]+$/i.test(v) || /^https?:\/\/[^\s/]+\/$/i.test(v),
      'Use the property exactly as Search Console shows it: sc-domain:example.com or https://www.example.com/',
    ),
  /** The service account's JSON key file contents. Blank keeps the saved key. */
  serviceAccountJson: z.string().max(10_000).optional().nullable(),
});

const serviceAccountSchema = z.object({
  type: z.literal('service_account'),
  client_email: z.string().email(),
  private_key: z.string().includes('PRIVATE KEY'),
});

async function stored(): Promise<Stored | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const v = row?.value as Partial<Stored> | null | undefined;
  if (!v?.siteUrl || !v.clientEmail || !v.privateKeyEnc) return null;
  return v as Stored;
}

export async function searchConsoleView() {
  const s = await stored();
  return s
    ? { connected: true, siteUrl: s.siteUrl, clientEmail: s.clientEmail, connectedAt: s.connectedAt }
    : { connected: false, siteUrl: null, clientEmail: null, connectedAt: null };
}

// ── Auth (service-account JWT bearer grant, RFC 7523) ──────────────────────

let tokenCache: { email: string; token: string; exp: number } | null = null;

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

async function accessToken(clientEmail: string, privateKey: string): Promise<string> {
  if (tokenCache && tokenCache.email === clientEmail && tokenCache.exp > Date.now() + 60_000)
    return tokenCache.token;
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  let signature: string;
  try {
    signature = crypto
      .createSign('RSA-SHA256')
      .update(`${header}.${claims}`)
      .sign(privateKey, 'base64url');
  } catch {
    throw badRequest('The service account private key could not be read');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token)
    throw badRequest(`Google refused the service account: ${body.error_description ?? res.status}`);
  tokenCache = {
    email: clientEmail,
    token: body.access_token,
    exp: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

async function gsc<T>(
  creds: { clientEmail: string; privateKey: string },
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await accessToken(creds.clientEmail, creds.privateKey);
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    const message = json.error?.message ?? `HTTP ${res.status}`;
    logger.warn({ status: res.status, path }, 'Search Console request failed');
    throw new HttpError(502, `Search Console: ${message}`, 'search_console_error');
  }
  return json;
}

async function credentials() {
  const s = await stored();
  if (!s) throw new HttpError(409, 'Search Console is not connected yet', 'not_connected');
  return { siteUrl: s.siteUrl, clientEmail: s.clientEmail, privateKey: decrypt(s.privateKeyEnc) };
}

/** Saves the connection after proving the service account can read the property. */
export async function saveSearchConsole(input: z.infer<typeof searchConsoleInputSchema>) {
  const existing = await stored();
  let clientEmail: string;
  let privateKey: string;
  if (input.serviceAccountJson?.trim()) {
    let parsed: z.infer<typeof serviceAccountSchema>;
    try {
      parsed = serviceAccountSchema.parse(JSON.parse(input.serviceAccountJson));
    } catch {
      throw badRequest('Paste the whole JSON key file of a Google Cloud service account');
    }
    clientEmail = parsed.client_email;
    privateKey = parsed.private_key;
  } else if (existing) {
    clientEmail = existing.clientEmail;
    privateKey = decrypt(existing.privateKeyEnc);
  } else {
    throw badRequest('Paste the service account JSON key');
  }

  tokenCache = null;
  const sites = await gsc<{ siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }>(
    { clientEmail, privateKey },
    '/webmasters/v3/sites',
  );
  const entry = sites.siteEntry?.find((s) => s.siteUrl === input.siteUrl);
  if (!entry || entry.permissionLevel === 'siteUnverifiedUser') {
    const available = sites.siteEntry?.map((s) => s.siteUrl).join(', ');
    throw badRequest(
      `${clientEmail} can't read ${input.siteUrl}. In Search Console → Settings → Users and permissions, add it as a user (Restricted is enough).${available ? ` It can currently see: ${available}` : ''}`,
    );
  }

  const value: Stored = {
    siteUrl: input.siteUrl,
    clientEmail,
    privateKeyEnc: encrypt(privateKey),
    connectedAt: new Date().toISOString(),
  };
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
  reportCache.clear();
}

export async function clearSearchConsole() {
  await prisma.siteSetting.deleteMany({ where: { key: KEY } });
  tokenCache = null;
  reportCache.clear();
}

// ── Reports ─────────────────────────────────────────────────────────────────

interface Row {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export const seoQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(480).default(28),
  page: z.string().url().max(500).optional(),
  query: z.string().max(300).optional(),
});

const reportCache = new Map<string, { at: number; value: unknown }>();

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function summarise(rows: Row[] | undefined) {
  const r = rows?.[0];
  return {
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: r?.ctr ?? 0,
    position: r?.position ?? 0,
  };
}

/**
 * Search performance for the last `days` days (ending yesterday, Google's
 * freshest complete-ish data), compared with the period before.
 */
export async function searchPerformance(q: z.infer<typeof seoQuerySchema>) {
  const cacheKey = JSON.stringify(q);
  const hit = reportCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const creds = await credentials();
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (q.days - 1) * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (q.days - 1) * 24 * 60 * 60 * 1000);

  const filters = [
    ...(q.page ? [{ dimension: 'page', operator: 'equals', expression: q.page }] : []),
    ...(q.query ? [{ dimension: 'query', operator: 'equals', expression: q.query }] : []),
  ];
  const path = `/webmasters/v3/sites/${encodeURIComponent(creds.siteUrl)}/searchAnalytics/query`;
  const run = (dimensions: string[], rowLimit: number, from = start, to = end) =>
    gsc<{ rows?: Row[] }>(creds, path, {
      startDate: ymd(from),
      endDate: ymd(to),
      dimensions,
      rowLimit,
      dataState: 'all',
      ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
    }).then((r) => r.rows ?? []);

  const [current, previous, byDate, queries, pages, countries, devices, appearance, prevPages, prevQueries] =
    await Promise.all([
      run([], 1),
      run([], 1, prevStart, prevEnd),
      run(['date'], 500),
      run(['query'], 250),
      run(['page'], 250),
      run(['country'], 25),
      run(['device'], 5),
      run(['searchAppearance'], 10).catch(() => [] as Row[]),
      run(['page'], 500, prevStart, prevEnd),
      run(['query'], 500, prevStart, prevEnd),
    ]);

  const prevPos = (rows: Row[]) =>
    new Map(rows.map((r) => [r.keys?.[0] ?? '', r.position] as const));
  const prevPageMap = prevPos(prevPages);
  const prevQueryMap = prevPos(prevQueries);
  const shape = (rows: Row[], prev?: Map<string, number>) =>
    rows.map((r) => ({
      key: r.keys?.[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
      previousPosition: prev?.get(r.keys?.[0] ?? '') ?? null,
    }));

  const queryRows = shape(queries, prevQueryMap);
  const value = {
    siteUrl: creds.siteUrl,
    range: { start: ymd(start), end: ymd(end), days: q.days },
    totals: summarise(current),
    previous: summarise(previous),
    series: byDate.map((r) => ({
      date: r.keys?.[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    queries: queryRows,
    pages: shape(pages, prevPageMap),
    countries: shape(countries),
    devices: shape(devices),
    searchAppearance: shape(appearance),
    /** Queries ranking on page 1 (positions 1-10), page 2 (11-20) and beyond. */
    rankBuckets: {
      top3: queryRows.filter((r) => r.position <= 3).length,
      top10: queryRows.filter((r) => r.position > 3 && r.position <= 10).length,
      top20: queryRows.filter((r) => r.position > 10 && r.position <= 20).length,
      beyond: queryRows.filter((r) => r.position > 20).length,
    },
    /** Many impressions, few clicks: titles/descriptions worth rewriting. */
    opportunities: queryRows
      .filter((r) => r.impressions >= 50 && r.position <= 20 && r.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 15),
    /** Ranking just off page one: the cheapest wins. */
    strikingDistance: queryRows
      .filter((r) => r.position > 10 && r.position <= 20 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 15),
  };
  reportCache.set(cacheKey, { at: Date.now(), value });
  if (reportCache.size > 50) reportCache.delete(reportCache.keys().next().value!);
  return value;
}

export async function sitemaps() {
  const creds = await credentials();
  const r = await gsc<{
    sitemap?: Array<{
      path: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      errors?: string;
      warnings?: string;
      contents?: Array<{ type: string; submitted?: string; indexed?: string }>;
    }>;
  }>(creds, `/webmasters/v3/sites/${encodeURIComponent(creds.siteUrl)}/sitemaps`);
  return (r.sitemap ?? []).map((s) => ({
    path: s.path,
    lastSubmitted: s.lastSubmitted ?? null,
    lastDownloaded: s.lastDownloaded ?? null,
    pending: !!s.isPending,
    errors: Number(s.errors ?? 0),
    warnings: Number(s.warnings ?? 0),
    submitted: (s.contents ?? []).reduce((n, c) => n + Number(c.submitted ?? 0), 0),
  }));
}

/** Google's index status for one of our own URLs (URL Inspection API; ~2,000/day quota). */
export async function inspectUrl(url: string) {
  const creds = await credentials();
  const site = new URL(env.appUrl);
  const target = new URL(url, site);
  if (target.host !== site.host) throw badRequest('Only this website’s own pages can be inspected');
  const r = await gsc<{
    inspectionResult?: {
      inspectionResultLink?: string;
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        pageFetchState?: string;
        googleCanonical?: string;
        userCanonical?: string;
        crawledAs?: string;
      };
      mobileUsabilityResult?: { verdict?: string };
      richResultsResult?: { verdict?: string; detectedItems?: Array<{ richResultType: string }> };
    };
  }>(creds, '/v1/urlInspection/index:inspect', {
    inspectionUrl: target.toString(),
    siteUrl: creds.siteUrl,
  });
  const i = r.inspectionResult ?? {};
  return {
    url: target.toString(),
    link: i.inspectionResultLink ?? null,
    verdict: i.indexStatusResult?.verdict ?? null,
    coverage: i.indexStatusResult?.coverageState ?? null,
    robots: i.indexStatusResult?.robotsTxtState ?? null,
    indexing: i.indexStatusResult?.indexingState ?? null,
    fetch: i.indexStatusResult?.pageFetchState ?? null,
    lastCrawl: i.indexStatusResult?.lastCrawlTime ?? null,
    googleCanonical: i.indexStatusResult?.googleCanonical ?? null,
    userCanonical: i.indexStatusResult?.userCanonical ?? null,
    crawledAs: i.indexStatusResult?.crawledAs ?? null,
    richResults: i.richResultsResult?.detectedItems?.map((d) => d.richResultType) ?? [],
  };
}
