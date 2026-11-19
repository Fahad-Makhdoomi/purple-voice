import type { MetadataRoute } from 'next';
import { postPath } from '@pv/shared';
import { siteUrl } from '@/lib/config';
import { getSitemapEntries } from '@/lib/server-api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { pages, posts } = await getSitemapEntries();
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/resources`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${siteUrl}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    ...posts.map((p) => ({
      url: `${siteUrl}${postPath(p)}`,
      lastModified: new Date(p.updatedAt),
      priority: 0.6,
    })),
    ...pages.map((p) => ({
      url: `${siteUrl}/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      priority: 0.3,
    })),
  ];
}
