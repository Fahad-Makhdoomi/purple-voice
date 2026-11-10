import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { hmacSha256Hex, randomToken } from '../lib/crypto';

/**
 * First-party, cookie-free website analytics.
 *
 * The site's tracker (components/site/PageTracker.tsx) posts one small beacon
 * per page view and one when the page is left (for time on page). Nothing is
 * stored on the visitor's device and no raw IP is kept: a visitor is a keyed
 * hash of IP + user agent + the day, so it can't be followed across days or
 * reversed — the same model as Plausible, which needs no consent banner.
 */

const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_DURATION_MS = 30 * 60 * 1000;
export const RETENTION_DAYS = 400;

export const collectSchema = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(1000).optional().nullable(),
  timeZone: z.string().max(64).optional().nullable(),
  language: z.string().max(35).optional().nullable(),
  width: z.number().int().min(0).max(20000).optional().nullable(),
});

export const leaveSchema = z.object({
  id: z.string().min(10).max(40),
  ms: z.number().int().min(0).max(24 * 60 * 60 * 1000),
});

const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|preview|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http-client|java\/|okhttp|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baiduspider|bytespider|gptbot|claudebot|perplexitybot|ccbot/i;

export function isBot(ua: string | undefined): boolean {
  return !ua || ua.length < 20 || BOT.test(ua);
}

/** Paths that are never part of the public website. */
const PRIVATE_PATH = /^\/(dashboard|admin|api|_next|builder-preview|uploads)(\/|$)/;

const SEARCH: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)search\.yahoo\.|(^|\.)yahoo\.com$/, 'Yahoo'],
  [/(^|\.)yandex\./, 'Yandex'],
  [/(^|\.)baidu\.com$/, 'Baidu'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'],
  [/(^|\.)search\.brave\.com$/, 'Brave Search'],
  [/(^|\.)naver\.com$/, 'Naver'],
];
const AI: Array<[RegExp, string]> = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)gemini\.google\.com$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'],
];
const SOCIAL: Array<[RegExp, string]> = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)twitter\.com$|^t\.co$|(^|\.)x\.com$/, 'X (Twitter)'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)pinterest\./, 'Pinterest'],
  [/(^|\.)quora\.com$/, 'Quora'],
  [/(^|\.)news\.ycombinator\.com$/, 'Hacker News'],
  [/(^|\.)producthunt\.com$/, 'Product Hunt'],
  [/(^|\.)whatsapp\.com$/, 'WhatsApp'],
];
const EMAIL_HOST = /mail\.|outlook\.|(^|\.)gmail\.com$/;

const match = (host: string, table: Array<[RegExp, string]>) =>
  table.find(([re]) => re.test(host))?.[1] ?? null;

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

/** Channel and named source, from UTM tags first, then the referrer. */
export function classify(
  referrerHost: string | null,
  utm: { source: string | null; medium: string | null; gclid: boolean },
): { channel: string; source: string | null } {
  const medium = utm.medium?.toLowerCase() ?? '';
  const src = utm.source;
  if (utm.gclid || /^(cpc|ppc|paid|paidsearch|paid_search|sem)$/.test(medium))
    return { channel: 'Paid Search', source: src ?? (utm.gclid ? 'Google Ads' : null) };
  if (/^(paid_?social|social_?paid|cpm)$/.test(medium))
    return { channel: 'Paid Social', source: src };
  if (/^(e-?mail|newsletter)$/.test(medium)) return { channel: 'Email', source: src };
  if (/^(social|social-network|social-media|sm)$/.test(medium))
    return { channel: 'Social', source: src };
  if (/^(organic)$/.test(medium)) return { channel: 'Organic Search', source: src };
  if (referrerHost) {
    const search = match(referrerHost, SEARCH);
    if (search) return { channel: 'Organic Search', source: search };
    const ai = match(referrerHost, AI);
    if (ai) return { channel: 'AI Assistants', source: ai };
    const social = match(referrerHost, SOCIAL);
    if (social) return { channel: 'Social', source: social };
    if (EMAIL_HOST.test(referrerHost)) return { channel: 'Email', source: referrerHost };
    return { channel: 'Referral', source: src ?? referrerHost };
  }
  if (src) return { channel: medium ? 'Campaign' : 'Referral', source: src };
  return { channel: 'Direct', source: null };
}

/** Coarse device, browser and OS from the user agent. Nothing finer is kept. */
export function parseUserAgent(ua: string, width?: number | null) {
  const device = /ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)
    ? 'Tablet'
    : /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)
      ? 'Mobile'
      : width && width < 768
        ? 'Mobile'
        : 'Desktop';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /samsungbrowser/i.test(ua)
        ? 'Samsung Internet'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /chrome|crios|chromium/i.test(ua)
            ? 'Chrome'
            : /safari/i.test(ua)
              ? 'Safari'
              : 'Other';
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /mac os x|macintosh/i.test(ua)
        ? 'macOS'
        : /android/i.test(ua)
          ? 'Android'
          : /cros/i.test(ua)
            ? 'ChromeOS'
            : /linux/i.test(ua)
              ? 'Linux'
              : 'Other';
  return { device, browser, os };
}

function visitorHash(ip: string, ua: string, day = new Date().toISOString().slice(0, 10)) {
  return hmacSha256Hex(env.URL_SIGNING_SECRET, `pv-visitor|${day}|${ip}|${ua}`).slice(0, 32);
}

const siteHost = (() => {
  try {
    return new URL(env.appUrl).host.toLowerCase();
  } catch {
    return '';
  }
})();

interface CollectContext {
  ip: string;
  userAgent: string;
  /** Two-letter country from a CDN header (Cloudflare `CF-IPCountry`), when present. */
  country: string | null;
}

/** Records one page view. Returns its id (for the leave beacon), or null when skipped. */
export async function recordPageView(
  input: z.infer<typeof collectSchema>,
  ctx: CollectContext,
): Promise<string | null> {
  if (isBot(ctx.userAgent)) return null;

  let url: URL;
  try {
    url = new URL(input.path, 'https://x.invalid');
  } catch {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (PRIVATE_PATH.test(path)) return null;

  let referrerHost: string | null = null;
  if (input.referrer) {
    try {
      const r = new URL(input.referrer);
      if (r.protocol === 'http:' || r.protocol === 'https:') {
        const host = r.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== siteHost.replace(/^www\./, '') && host !== 'localhost') referrerHost = host;
      }
    } catch {
      /* not a URL */
    }
  }

  const q = url.searchParams;
  const utmSource = clip(q.get('utm_source') ?? q.get('ref') ?? q.get('source'), 100);
  const utmMedium = clip(q.get('utm_medium'), 100);
  const utmCampaign = clip(q.get('utm_campaign'), 150);
  const utmTerm = clip(q.get('utm_term'), 150);
  const { channel, source } = classify(referrerHost, {
    source: utmSource,
    medium: utmMedium,
    gclid: q.has('gclid') || q.has('msclkid'),
  });

  const hash = visitorHash(ctx.ip, ctx.userAgent);
  const previous = await prisma.pageView.findFirst({
    where: { visitorHash: hash, createdAt: { gt: new Date(Date.now() - SESSION_GAP_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { sessionId: true },
  });
  // Arriving from outside (another site, a search engine or a tagged campaign
  // link) starts a new visit even mid-session, as in GA4. Moving between our
  // own pages has no referrer host and no tags, so it is always "Direct".
  const newSession = !previous || channel !== 'Direct';
  const sessionId = newSession
    ? randomToken(12)
    : previous.sessionId;

  const { device, browser, os } = parseUserAgent(ctx.userAgent, input.width);
  const country = ctx.country && /^[A-Z]{2}$/.test(ctx.country) && ctx.country !== 'XX'
    ? ctx.country
    : null;

  const view = await prisma.pageView.create({
    data: {
      path: path.slice(0, 300),
      visitorHash: hash,
      sessionId,
      isEntry: newSession,
      referrerHost: clip(referrerHost, 200),
      channel,
      source: clip(source, 200),
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      device,
      browser,
      os,
      country,
      timeZone: clip(input.timeZone && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(input.timeZone) ? input.timeZone : null, 64),
      language: clip(input.language?.split(',')[0]?.trim() ?? null, 35),
    },
    select: { id: true },
  });
  return view.id;
}

/** Time on page. Only the visitor who made the view (same day hash) can set it. */
export async function recordLeave(input: z.infer<typeof leaveSchema>, ctx: CollectContext) {
  if (isBot(ctx.userAgent)) return;
  await prisma.pageView.updateMany({
    where: {
      id: input.id,
      visitorHash: visitorHash(ctx.ip, ctx.userAgent),
      createdAt: { gt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    data: { durationMs: Math.min(input.ms, MAX_DURATION_MS) },
  });
}

export async function pruneOldPageViews() {
  await prisma.pageView.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
  });
}

// ── Reports ─────────────────────────────────────────────────────────────────

export const reportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(RETENTION_DAYS).default(30),
  path: z.string().max(300).optional(),
  channel: z.string().max(40).optional(),
});

type Filters = z.infer<typeof reportQuerySchema>;

const DAY = 24 * 60 * 60 * 1000;

function where(from: Date, to: Date, f: Filters) {
  const parts = [Prisma.sql`"createdAt" >= ${from} AND "createdAt" < ${to}`];
  if (f.path) parts.push(Prisma.sql`"path" = ${f.path}`);
  if (f.channel) parts.push(Prisma.sql`"sessionId" IN (SELECT "sessionId" FROM "PageView" WHERE "isEntry" AND "channel" = ${f.channel} AND "createdAt" >= ${new Date(from.getTime() - DAY)} AND "createdAt" < ${to})`);
  return Prisma.join(parts, ' AND ');
}

interface Totals {
  views: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  avgVisitSeconds: number;
  viewsPerVisit: number;
}

async function totals(from: Date, to: Date, f: Filters): Promise<Totals> {
  const w = where(from, to, f);
  const [row] = await prisma.$queryRaw<
    Array<{ views: bigint; visitors: bigint; visits: bigint; bounces: bigint; dur: number | null }>
  >`
    WITH s AS (
      SELECT "sessionId", COUNT(*) AS n, COALESCE(SUM("durationMs"), 0) AS ms
      FROM "PageView" WHERE ${w} GROUP BY "sessionId"
    )
    SELECT
      (SELECT COUNT(*) FROM "PageView" WHERE ${w}) AS views,
      (SELECT COUNT(DISTINCT "visitorHash") FROM "PageView" WHERE ${w}) AS visitors,
      (SELECT COUNT(*) FROM s) AS visits,
      (SELECT COUNT(*) FROM s WHERE n = 1) AS bounces,
      (SELECT AVG(ms)::float FROM s) AS dur`;
  const views = Number(row?.views ?? 0);
  const visits = Number(row?.visits ?? 0);
  return {
    views,
    visitors: Number(row?.visitors ?? 0),
    visits,
    bounceRate: visits ? Number(row!.bounces) / visits : 0,
    avgVisitSeconds: Math.round((row?.dur ?? 0) / 1000),
    viewsPerVisit: visits ? views / visits : 0,
  };
}

const num = (rows: Array<Record<string, unknown>>) =>
  rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]),
    ),
  );

/** Everything the Traffic page shows, for the last `days` days, with the previous period for comparison. */
export async function trafficReport(f: Filters) {
  const to = new Date();
  const from = new Date(to.getTime() - f.days * DAY);
  const prevFrom = new Date(from.getTime() - f.days * DAY);
  const w = where(from, to, f);
  const bucket = f.days <= 2 ? 'hour' : 'day';
  const unit = Prisma.raw(`'${bucket}'`);

  const group = (col: string, limit = 12) => {
    const c = Prisma.raw(`"${col}"`);
    return prisma.$queryRaw<Array<{ label: string | null; views: bigint; visitors: bigint }>>`
      SELECT ${c} AS label, COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
      FROM "PageView" WHERE ${w} GROUP BY ${c} ORDER BY visitors DESC, views DESC LIMIT ${limit}`;
  };
  /** Visits by a property of the landing (entry) view. */
  const entryGroup = (col: string, limit = 12) => {
    const c = Prisma.raw(`"${col}"`);
    return prisma.$queryRaw<
      Array<{ label: string | null; visits: bigint; visitors: bigint; bounces: bigint }>
    >`
      WITH s AS (SELECT "sessionId", COUNT(*) AS n FROM "PageView" WHERE ${w} GROUP BY "sessionId")
      SELECT p.${c} AS label, COUNT(*) AS visits, COUNT(DISTINCT p."visitorHash") AS visitors,
             COUNT(*) FILTER (WHERE s.n = 1) AS bounces
      FROM "PageView" p JOIN s ON s."sessionId" = p."sessionId"
      WHERE p."isEntry" AND p."createdAt" >= ${from} AND p."createdAt" < ${to}
      GROUP BY p.${c} ORDER BY visits DESC LIMIT ${limit}`;
  };

  const [
    current,
    previous,
    series,
    pages,
    entries,
    exits,
    channels,
    sources,
    campaigns,
    devices,
    browsers,
    oses,
    countries,
    timeZones,
    organicLanding,
  ] = await Promise.all([
    totals(from, to, f),
    totals(prevFrom, from, f),
    prisma.$queryRaw<Array<{ t: Date; views: bigint; visitors: bigint; visits: bigint }>>`
      SELECT date_trunc(${unit}, "createdAt") AS t, COUNT(*) AS views,
             COUNT(DISTINCT "visitorHash") AS visitors, COUNT(DISTINCT "sessionId") AS visits
      FROM "PageView" WHERE ${w} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<
      Array<{ path: string; views: bigint; visitors: bigint; avgSeconds: number | null }>
    >`
      SELECT "path", COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors,
             (AVG("durationMs") / 1000)::float AS "avgSeconds"
      FROM "PageView" WHERE ${w} GROUP BY "path" ORDER BY views DESC LIMIT 50`,
    entryGroup('path', 25),
    prisma.$queryRaw<Array<{ label: string; exits: bigint }>>`
      SELECT label, COUNT(*) AS exits FROM (
        SELECT DISTINCT ON ("sessionId") "path" AS label FROM "PageView" WHERE ${w}
        ORDER BY "sessionId", "createdAt" DESC) t
      GROUP BY label ORDER BY exits DESC LIMIT 25`,
    entryGroup('channel', 12),
    entryGroup('source', 25),
    prisma.$queryRaw<
      Array<{ campaign: string; source: string | null; medium: string | null; visits: bigint }>
    >`
      SELECT "utmCampaign" AS campaign, "utmSource" AS source, "utmMedium" AS medium, COUNT(*) AS visits
      FROM "PageView" WHERE ${w} AND "isEntry" AND "utmCampaign" IS NOT NULL
      GROUP BY 1, 2, 3 ORDER BY visits DESC LIMIT 25`,
    group('device', 5),
    group('browser', 8),
    group('os', 8),
    group('country', 25),
    group('timeZone', 25),
    prisma.$queryRaw<Array<{ path: string; source: string | null; visits: bigint }>>`
      SELECT "path", "source", COUNT(*) AS visits FROM "PageView"
      WHERE ${w} AND "isEntry" AND "channel" = 'Organic Search'
      GROUP BY 1, 2 ORDER BY visits DESC LIMIT 50`,
  ]);

  return {
    range: { from: from.toISOString(), to: to.toISOString(), days: f.days, bucket },
    totals: current,
    previous,
    series: series.map((r) => ({
      t: r.t.toISOString(),
      views: Number(r.views),
      visitors: Number(r.visitors),
      visits: Number(r.visits),
    })),
    pages: num(pages),
    entryPages: num(entries).map((r) => ({
      ...r,
      bounceRate: Number(r.visits) ? Number(r.bounces) / Number(r.visits) : 0,
    })),
    exitPages: num(exits),
    channels: num(channels),
    sources: num(sources).filter((r) => r.label),
    campaigns: num(campaigns),
    devices: num(devices),
    browsers: num(browsers),
    os: num(oses),
    countries: num(countries).filter((r) => r.label),
    timeZones: num(timeZones).filter((r) => r.label),
    organicLanding: num(organicLanding),
  };
}

/** Visitors on the site in the last five minutes, and what they're reading. */
export async function liveReport() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const [visitors, pages] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      distinct: ['visitorHash'],
      select: { visitorHash: true },
    }),
    prisma.pageView.groupBy({
      by: ['path'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    }),
  ]);
  return {
    visitors: visitors.length,
    pages: pages.map((p) => ({ path: p.path, views: p._count._all })),
  };
}
