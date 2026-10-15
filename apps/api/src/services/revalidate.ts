import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Tells the Next.js app to drop cached copies of public pages after CMS
 * content changes, so edits go live in seconds while pages stay statically
 * served (which is what keeps PageSpeed above 90).
 *
 * Tags used by the web app: "pages", "page:<slug>", "posts", "post:<slug>",
 * "faqs", "plans", "settings".
 */
export function revalidate(tags: string[]): void {
  if (!env.REVALIDATE_SECRET) return;
  void fetch(`${env.WEB_INTERNAL_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => logger.warn({ err, tags }, 'Revalidation request failed'));
}
