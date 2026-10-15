import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Called by the API after CMS edits (see apps/api/src/services/revalidate.ts).
 * Drops cached copies of the affected public pages by tag.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  const given = req.headers.get('x-revalidate-secret') ?? '';
  const ok =
    secret.length > 0 &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string').slice(0, 50)
    : [];
  for (const tag of tags) revalidateTag(tag);
  return NextResponse.json({ revalidated: tags });
}
