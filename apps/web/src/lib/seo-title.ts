import type { Metadata } from 'next';
import { getSettings } from './server-api';

/** Google shows about 60 characters of a title; past that it is cut off. */
const MAX_TITLE = 60;

/**
 * The page title for metadata: with the site's suffix (" · Purple Voice")
 * when the whole thing fits in a search result, otherwise the title alone,
 * so long post titles aren't cut off mid-word in Google.
 */
export async function fitTitle(title: string): Promise<Metadata['title']> {
  const { seo } = await getSettings();
  const full = seo.titleTemplate.includes('%s') ? seo.titleTemplate.replace('%s', title) : title;
  return full.length <= MAX_TITLE ? title : { absolute: title };
}
