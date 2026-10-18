import 'server-only';
import {
  PLAN_LIST,
  type AppearanceSettings,
  type PlanCode,
  type SeoSettings,
} from '@pv/shared';

/**
 * Server-side reads for the public website. Responses are cached by Next
 * (ISR) under tags the API invalidates when staff edit content, so pages
 * are served statically and refresh within seconds of an edit.
 *
 * Every reader has a fallback so `next build` and the site keep working
 * when the API is unreachable.
 */

const API = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const HOUR = 3600;

async function get<T>(path: string, tags: string[], fallback: T, revalidate = HOUR): Promise<T> {
  try {
    const res = await fetch(`${API}/api/public${path}`, { next: { tags, revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface PublicPlan {
  code: PlanCode;
  name: string;
  tagline: string;
  priceMonthlyCents: number | null;
  includedMinutes: number | null;
  highlights: string[];
  featured: boolean;
  selfServe: boolean;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

export async function getPlans(): Promise<PublicPlan[]> {
  const fallback = PLAN_LIST.map((p) => ({
    ...p,
    limits: { ...p.limits },
    features: { ...p.features },
  }));
  const data = await get<{ plans: PublicPlan[] }>('/plans', ['plans'], { plans: fallback });
  return data.plans.length ? data.plans : fallback;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}
export async function getFaqs(): Promise<Faq[]> {
  return (await get<{ faqs: Faq[] }>('/faqs', ['faqs'], { faqs: [] })).faqs;
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string;
  author: { name: string } | null;
}
export async function getPosts(page = 1, tag?: string) {
  const q = new URLSearchParams({ page: String(page), pageSize: '12', ...(tag ? { tag } : {}) });
  return get<{ posts: PostSummary[]; total: number; page: number; pageSize: number }>(
    `/posts?${q}`,
    ['posts'],
    {
      posts: [],
      total: 0,
      page,
      pageSize: 12,
    },
  );
}

export interface Post extends PostSummary {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
  updatedAt: string;
}
export async function getPost(slug: string) {
  return get<{ post: Post; related: PostSummary[] } | null>(
    `/posts/${encodeURIComponent(slug)}`,
    ['posts', `post:${slug}`],
    null,
  );
}

export interface CmsPage {
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
  updatedAt: string;
}
export async function getPage(slug: string) {
  return (
    (
      await get<{ page: CmsPage } | null>(
        `/pages/${encodeURIComponent(slug)}`,
        ['pages', `page:${slug}`],
        null,
      )
    )?.page ?? null
  );
}
export async function getFooterPages() {
  const data = await get<{ pages: Array<{ slug: string; title: string; showInFooter: boolean }> }>(
    '/pages',
    ['pages'],
    { pages: [] },
  );
  return data.pages.filter((p) => p.showInFooter);
}

export interface PublicSettings {
  seo: SeoSettings;
  analytics: { plausibleDomain?: string | null; ga4MeasurementId?: string | null };
  appearance: AppearanceSettings;
  captcha: {
    provider: 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha';
    forms: Record<string, boolean>;
  };
}
export const DEFAULT_SEO: SeoSettings = {
  siteName: 'Purple Voice',
  defaultTitle: 'Purple Voice — AI voice agents for sales calls',
  titleTemplate: '%s · Purple Voice',
  defaultDescription:
    'Create, manage and run AI voice agents that call your leads, qualify them, book appointments and hand hot prospects to your team.',
  ogImageUrl: null,
  twitterHandle: null,
  contactEmail: 'hello@purplevoice.ai',
  googleSiteVerification: null,
};
export const DEFAULT_APPEARANCE: AppearanceSettings = { theme: 'default', music: true };

export async function getSettings(): Promise<PublicSettings> {
  const settings = await get<PublicSettings>('/settings', ['settings'], {
    seo: DEFAULT_SEO,
    analytics: {},
    appearance: DEFAULT_APPEARANCE,
    captcha: { provider: 'none', forms: {} },
  });
  // An API from before themes existed sends no `appearance`.
  return { ...settings, appearance: settings.appearance ?? DEFAULT_APPEARANCE };
}

/** The active website theme (Super admin → Website theme). */
export async function getAppearance(): Promise<AppearanceSettings> {
  return (await getSettings()).appearance;
}

export async function getSitemapEntries() {
  return get<{
    pages: Array<{ slug: string; updatedAt: string }>;
    posts: Array<{ slug: string; updatedAt: string }>;
  }>('/sitemap', ['pages', 'posts'], { pages: [], posts: [] });
}
