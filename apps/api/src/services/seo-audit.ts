import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * On-site SEO health: crawls every URL in our own sitemap.xml and checks
 * what search engines read — status, title, meta description, canonical,
 * robots, H1, Open Graph, structured data, image alt text, word count and
 * response time. Only URLs on our own host are fetched.
 */

const MAX_URLS = 300;
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;

export type Severity = 'error' | 'warning' | 'notice';

export interface PageAudit {
  url: string;
  path: string;
  status: number;
  ms: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  h1Count: number;
  wordCount: number;
  imagesMissingAlt: number;
  hasOgImage: boolean;
  structuredData: string[];
  issues: Array<{ severity: Severity; message: string }>;
}

export interface SiteAudit {
  runAt: string;
  site: string;
  score: number;
  pages: PageAudit[];
  siteIssues: Array<{ severity: Severity; message: string }>;
}

let last: SiteAudit | null = null;
let running: Promise<SiteAudit> | null = null;

export const lastSiteAudit = () => last;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, attr: 'name' | 'property', key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content != null ? decode(content) : null;
}

function base(): URL {
  return new URL(env.appUrl);
}

async function get(url: string) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'PurpleVoice-SEO-Audit/1.0 (+self)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = res.status < 300 ? await res.text() : '';
  return { status: res.status, ms: Date.now() - started, text, headers: res.headers };
}

function auditHtml(url: URL, status: number, ms: number, html: string, robotsHeader: string | null): PageAudit {
  const issues: PageAudit['issues'] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const t = title ? decode(title) : null;
  const description = meta(html, 'name', 'description');
  const robots = `${meta(html, 'name', 'robots') ?? ''} ${robotsHeader ?? ''}`.toLowerCase();
  const noindex = robots.includes('noindex');
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0].match(/href=["']([^"']+)["']/i)?.[1] ??
    null;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .match(/<main[\s\S]*<\/main>/i)?.[0] ?? html;
  const words = decode(body.replace(/<[^>]+>/g, ' ')).split(' ').filter((w) => /\w/.test(w));
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgs.filter((i) => !/\balt=["'][^"']+["']/i.test(i) && !/aria-hidden=["']true/i.test(i) && !/\balt=""/.test(i)).length;
  const hasOgImage = !!meta(html, 'property', 'og:image');
  const structuredData = [
    ...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ].flatMap((m) => {
    try {
      const j = JSON.parse(m[1]) as { '@type'?: string | string[]; '@graph'?: Array<{ '@type'?: string }> };
      const types = j['@graph'] ? j['@graph'].map((g) => g['@type']) : [j['@type']];
      return types.flat().filter((x): x is string => typeof x === 'string');
    } catch {
      return ['(invalid JSON-LD)'];
    }
  });

  if (status >= 400) issues.push({ severity: 'error', message: `Returns HTTP ${status}` });
  else if (status >= 300) issues.push({ severity: 'warning', message: `Redirects (HTTP ${status}) — the sitemap should list the final URL` });
  if (status < 300) {
    if (!t) issues.push({ severity: 'error', message: 'Missing <title>' });
    else if (t.length > 65) issues.push({ severity: 'warning', message: `Title is ${t.length} characters; Google shows about 60` });
    else if (t.length < 20) issues.push({ severity: 'notice', message: `Title is short (${t.length} characters)` });
    if (!description) issues.push({ severity: 'error', message: 'Missing meta description' });
    else if (description.length > 170) issues.push({ severity: 'warning', message: `Meta description is ${description.length} characters; aim for 140–160` });
    else if (description.length < 70) issues.push({ severity: 'notice', message: `Meta description is short (${description.length} characters)` });
    if (noindex) issues.push({ severity: 'error', message: 'Marked noindex but listed in the sitemap' });
    if (!canonical) issues.push({ severity: 'warning', message: 'No canonical URL' });
    else {
      try {
        const c = new URL(canonical, url);
        if (c.pathname.replace(/\/$/, '') !== url.pathname.replace(/\/$/, ''))
          issues.push({ severity: 'warning', message: `Canonical points elsewhere (${c.pathname})` });
      } catch {
        issues.push({ severity: 'warning', message: 'Canonical URL is invalid' });
      }
    }
    if (h1Count === 0) issues.push({ severity: 'warning', message: 'No H1 heading' });
    if (h1Count > 1) issues.push({ severity: 'notice', message: `${h1Count} H1 headings; use one` });
    if (words.length < 250) issues.push({ severity: 'notice', message: `Thin content (${words.length} words)` });
    if (imagesMissingAlt) issues.push({ severity: 'warning', message: `${imagesMissingAlt} image(s) without alt text` });
    if (!hasOgImage) issues.push({ severity: 'notice', message: 'No Open Graph image for social shares' });
    if (structuredData.includes('(invalid JSON-LD)')) issues.push({ severity: 'error', message: 'Invalid structured data (JSON-LD)' });
    if (ms > 1500) issues.push({ severity: 'warning', message: `Slow server response (${ms} ms)` });
  }

  return {
    url: url.toString(),
    path: url.pathname,
    status,
    ms,
    title: t,
    description,
    canonical,
    noindex,
    h1Count,
    wordCount: words.length,
    imagesMissingAlt,
    hasOgImage,
    structuredData: [...new Set(structuredData)],
    issues,
  };
}

async function crawl(): Promise<SiteAudit> {
  const site = base();
  const siteIssues: SiteAudit['siteIssues'] = [];

  const robots = await get(new URL('/robots.txt', site).toString()).catch(() => null);
  if (!robots || robots.status !== 200) siteIssues.push({ severity: 'error', message: 'robots.txt is missing' });
  else {
    if (/^\s*disallow:\s*\/\s*$/im.test(robots.text))
      siteIssues.push({ severity: 'error', message: 'robots.txt blocks the whole site (Disallow: /)' });
    if (!/sitemap:/i.test(robots.text))
      siteIssues.push({ severity: 'notice', message: 'robots.txt does not reference the sitemap' });
  }

  const sm = await get(new URL('/sitemap.xml', site).toString()).catch(() => null);
  const urls: URL[] = [];
  if (!sm || sm.status !== 200) siteIssues.push({ severity: 'error', message: 'sitemap.xml is missing' });
  else {
    for (const m of sm.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      try {
        const u = new URL(decode(m[1]));
        // Fetch only our own pages, via our own origin.
        const own = new URL(u.pathname + u.search, site);
        if (u.host !== site.host)
          siteIssues.push({ severity: 'warning', message: `Sitemap lists ${u.host}, but the site runs on ${site.host}` });
        if (!urls.some((x) => x.href === own.href)) urls.push(own);
      } catch {
        /* skip */
      }
      if (urls.length >= MAX_URLS) break;
    }
    if (!urls.length) siteIssues.push({ severity: 'error', message: 'sitemap.xml lists no URLs' });
  }
  if (site.protocol !== 'https:' && env.isProd)
    siteIssues.push({ severity: 'error', message: 'The site is not served over HTTPS' });

  const pages: PageAudit[] = [];
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        const r = await get(url.toString());
        pages.push(auditHtml(url, r.status, r.ms, r.text, r.headers.get('x-robots-tag')));
      } catch (err) {
        pages.push(auditHtml(url, 599, TIMEOUT_MS, '', null));
        logger.warn({ err, url: url.toString() }, 'SEO audit fetch failed');
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  pages.sort((a, b) => a.path.localeCompare(b.path));

  // Duplicates across pages.
  const dupes = (key: 'title' | 'description', label: string) => {
    const seen = new Map<string, PageAudit[]>();
    for (const p of pages) if (p[key]) seen.set(p[key]!, [...(seen.get(p[key]!) ?? []), p]);
    for (const [, list] of seen)
      if (list.length > 1)
        for (const p of list)
          p.issues.push({ severity: 'warning', message: `Same ${label} as ${list.filter((x) => x !== p).map((x) => x.path).join(', ')}` });
  };
  dupes('title', 'title');
  dupes('description', 'meta description');

  const weight = { error: 10, warning: 3, notice: 1 } as const;
  const penalty =
    pages.reduce((n, p) => n + p.issues.reduce((m, x) => m + weight[x.severity], 0), 0) /
      Math.max(1, pages.length) +
    siteIssues.reduce((n, x) => n + weight[x.severity] * 2, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty * 3)));

  return { runAt: new Date().toISOString(), site: site.origin, score, pages, siteIssues };
}

/** Runs one crawl at a time; concurrent callers share it. */
export async function runSiteAudit(): Promise<SiteAudit> {
  if (!running)
    running = crawl()
      .then((r) => (last = r))
      .finally(() => (running = null));
  return running;
}

/** Google PageSpeed Insights (Lighthouse + real-user Core Web Vitals) for one of our pages. */
export async function pageSpeed(path: string, strategy: 'mobile' | 'desktop') {
  const target = new URL(path, base());
  if (target.host !== base().host) throw new Error('Only this site can be tested');
  const q = new URLSearchParams({ url: target.toString(), strategy });
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices']) q.append('category', c);
  if (env.PAGESPEED_API_KEY) q.set('key', env.PAGESPEED_API_KEY);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {
    signal: AbortSignal.timeout(90_000),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    lighthouseResult?: {
      categories?: Record<string, { score: number | null }>;
      audits?: Record<string, { displayValue?: string; numericValue?: number }>;
    };
    loadingExperience?: {
      overall_category?: string;
      metrics?: Record<string, { percentile: number; category: string }>;
    };
  };
  if (!res.ok) throw new Error(j.error?.message ?? `PageSpeed HTTP ${res.status}`);
  const cat = j.lighthouseResult?.categories ?? {};
  const a = j.lighthouseResult?.audits ?? {};
  const field = j.loadingExperience?.metrics ?? {};
  const score = (k: string) => (cat[k]?.score != null ? Math.round(cat[k].score! * 100) : null);
  return {
    url: target.toString(),
    strategy,
    scores: {
      performance: score('performance'),
      seo: score('seo'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
    },
    lab: {
      lcp: a['largest-contentful-paint']?.displayValue ?? null,
      cls: a['cumulative-layout-shift']?.displayValue ?? null,
      tbt: a['total-blocking-time']?.displayValue ?? null,
      fcp: a['first-contentful-paint']?.displayValue ?? null,
      si: a['speed-index']?.displayValue ?? null,
    },
    /** Chrome UX Report data from real visitors, when Google has enough of it. */
    field: j.loadingExperience?.metrics
      ? {
          overall: j.loadingExperience.overall_category ?? null,
          lcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          inpMs: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE
            ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : null,
        }
      : null,
  };
}
