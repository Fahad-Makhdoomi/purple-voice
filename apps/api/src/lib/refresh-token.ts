import type { Session } from '@prisma/client';

/**
 * A rotated refresh token that comes back within this long is a second tab
 * (or a retried request) refreshing at the same moment, not a stolen copy:
 * it gets a new session in the same family instead of ending them all.
 */
export const REFRESH_REUSE_GRACE_MS = 60_000;

/**
 * What /auth/refresh does with the token it was sent:
 *   rotate      current token: issue the next one and retire this one
 *   concurrent  just rotated by a parallel refresh: issue another, keep the family
 *   reused      rotated or revoked a while ago: someone else holds a copy, end the family
 *   expired     unknown or past its expiry: sign in again
 */
export type RefreshVerdict = 'rotate' | 'concurrent' | 'reused' | 'expired';

export function refreshVerdict(
  session: Pick<Session, 'expiresAt' | 'revokedAt' | 'replacedBy'> | null,
  now = new Date(),
): RefreshVerdict {
  if (!session || session.expiresAt < now) return 'expired';
  if (!session.revokedAt) return 'rotate';
  const sinceRotation = now.getTime() - session.revokedAt.getTime();
  if (session.replacedBy && sinceRotation <= REFRESH_REUSE_GRACE_MS) return 'concurrent';
  return 'reused';
}
