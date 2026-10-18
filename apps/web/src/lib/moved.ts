import 'server-only';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getRedirect } from '@/lib/server-api';

/**
 * For a page or post that isn't there: follow the redirect left when its
 * address changed (permanent, so search rankings move with it), else 404.
 */
export async function notFoundOrMoved(path: string): Promise<never> {
  const moved = await getRedirect(path);
  if (moved) {
    if (moved.permanent) permanentRedirect(moved.toPath);
    redirect(moved.toPath);
  }
  notFound();
}
