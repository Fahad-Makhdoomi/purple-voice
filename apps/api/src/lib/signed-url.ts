import { env } from '../config/env';
import { hmacSha256Hex, safeEqual } from './crypto';

/**
 * Every URL we hand to a telephony provider (answer URL, status callback,
 * media-stream WebSocket) carries `sig`, an HMAC over its purpose and subject.
 * That authenticates the callback without depending on each provider's own
 * signature scheme, and stops anyone who guesses a call id from driving it.
 */

export type SignedPurpose = 'voice' | 'status' | 'media' | 'transfer' | 'inbound';

export function signSubject(purpose: SignedPurpose, subject: string): string {
  return hmacSha256Hex(env.URL_SIGNING_SECRET, `${purpose}:${subject}`).slice(0, 40);
}

export function verifySubject(purpose: SignedPurpose, subject: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || sig.length !== 40) return false;
  return safeEqual(signSubject(purpose, subject), sig);
}

/** https://host/api/telephony/<provider>/<purpose>?<key>=<subject>&sig=… */
export function signedCallbackUrl(
  provider: string,
  purpose: SignedPurpose,
  key: 'callId' | 'numberId',
  subject: string,
): string {
  const u = new URL(`${env.publicApiUrl}/api/telephony/${provider.toLowerCase()}/${purpose}`);
  u.searchParams.set(key, subject);
  u.searchParams.set('sig', signSubject(purpose, subject));
  return u.toString();
}

/**
 * Short-lived signed state for OAuth round trips: base64url(JSON).signature.
 * Expires after `ttlSec`; tampering or expiry returns null.
 */
export function signState(payload: Record<string, string>, ttlSec = 600): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }),
  ).toString('base64url');
  return `${body}.${hmacSha256Hex(env.URL_SIGNING_SECRET, `state:${body}`)}`;
}

export function verifyState<T extends Record<string, string>>(state: unknown): T | null {
  if (typeof state !== 'string') return null;
  const [body, sig] = state.split('.');
  if (!body || !sig || !safeEqual(hmacSha256Hex(env.URL_SIGNING_SECRET, `state:${body}`), sig))
    return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}
