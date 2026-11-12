import crypto from 'node:crypto';
import type { Request } from 'express';
import type { TelephonyAccount } from '@prisma/client';
import { env } from '../config/env';
import { decryptJson } from '../lib/crypto';
import { forbidden } from '../lib/http-error';
import { logger } from '../lib/logger';
import { safeEqual } from '../lib/crypto';

/**
 * Twilio signs every webhook: base64(HMAC-SHA1(auth token, URL + each POST
 * parameter name and value, sorted by name)). Our callback URLs are already
 * HMAC-signed by us, but they never expire; this second check means a leaked
 * callback URL alone can't fake calls or call status.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, unknown>) {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => `${k}${String(params[k] ?? '')}`)
      .join('');
  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

/**
 * Plivo V2: base64(HMAC-SHA256(auth token, URL without its query + nonce)),
 * headers X-Plivo-Signature-V2 and X-Plivo-Signature-V2-Nonce.
 */
export function plivoSignatureV2(authToken: string, url: string, nonce: string) {
  const u = new URL(url);
  return crypto
    .createHmac('sha256', authToken)
    .update(`${u.origin}${u.pathname}${nonce}`, 'utf8')
    .digest('base64');
}

function sortedQuery(params: Record<string, string[]>): string {
  return Object.keys(params)
    .sort()
    .flatMap((k) => [...params[k]].sort().map((v) => `${k}=${v}`))
    .join('&');
}

/**
 * Plivo V3 (X-Plivo-Signature-V3, may hold several comma-separated values):
 * base64(HMAC-SHA256(auth token, base + "." + nonce)), where for a POST the
 * base is the URL with its query sorted, then the POST fields sorted by name
 * as name+value (the construction in Plivo's SDKs).
 */
export function plivoSignatureV3(
  authToken: string,
  url: string,
  nonce: string,
  method: string,
  params: Record<string, unknown>,
) {
  const u = new URL(url);
  const query: Record<string, string[]> = {};
  u.searchParams.forEach((v, k) => (query[k] ??= []).push(v));
  const fields = Object.entries(params).filter(([, v]) => v !== undefined);
  let base = `${u.origin}${u.pathname}`;
  const q = sortedQuery(query);
  if (method.toUpperCase() === 'GET') {
    for (const [k, v] of fields) (query[k] ??= []).push(String(v));
    const all = sortedQuery(query);
    if (all) base += `?${all}`;
  } else {
    const empty = fields.length === 0;
    if (q || !empty) base += `?${q}`;
    if (q && !empty) base += '.';
    base += fields
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}${String(v)}`)
      .join('');
  }
  return crypto.createHmac('sha256', authToken).update(`${base}.${nonce}`, 'utf8').digest('base64');
}

function signatureOk(
  req: Request,
  provider: string,
  authToken: string,
  url: string,
  params: Record<string, unknown>,
): { ok: boolean; hasHeader: boolean } {
  if (provider === 'TWILIO') {
    const given = req.header('x-twilio-signature') ?? '';
    return {
      ok: !!given && safeEqual(given, twilioSignature(authToken, url, params)),
      hasHeader: !!given,
    };
  }
  // PLIVO
  const v3 = req.header('x-plivo-signature-v3');
  const v3Nonce = req.header('x-plivo-signature-v3-nonce');
  if (v3 && v3Nonce) {
    const expected = plivoSignatureV3(authToken, url, v3Nonce, req.method, params);
    if (v3.split(',').some((s) => safeEqual(s.trim(), expected)))
      return { ok: true, hasHeader: true };
  }
  const v2 = req.header('x-plivo-signature-v2');
  const v2Nonce = req.header('x-plivo-signature-v2-nonce');
  if (v2 && v2Nonce && safeEqual(v2, plivoSignatureV2(authToken, url, v2Nonce)))
    return { ok: true, hasHeader: true };
  return { ok: false, hasHeader: !!(v3 || v2) };
}

/**
 * Checks the carrier's own request signature (Twilio and Plivo) on top of
 * our signed callback URLs. TELEPHONY_SIGNATURE_MODE: "log" reports
 * mismatches, "enforce" rejects them, "off" skips the check.
 *
 * The other carriers rely on our signed callback URLs alone: SignalWire signs
 * with a separate Signing Key over the raw body, Telnyx with ed25519 over the
 * raw body, Vonage with a JWT keyed by a separate signature secret, and
 * Bandwidth and Exotel use optional basic auth. None can be checked with the
 * credentials we store and the parsed body, and a wrong check would reject
 * real calls.
 */
export function assertCarrierSignature(
  req: Request,
  account: Pick<TelephonyAccount, 'provider' | 'credentialsEnc'>,
) {
  if (env.TELEPHONY_SIGNATURE_MODE === 'off') return;
  if (account.provider !== 'TWILIO' && account.provider !== 'PLIVO') return;
  const { authToken } = decryptJson<{ authToken?: string }>(account.credentialsEnc);
  if (!authToken) return;
  const url = `${env.publicApiUrl}${req.originalUrl}`;
  const params = (req.method === 'GET' ? {} : (req.body ?? {})) as Record<string, unknown>;
  const { ok, hasHeader } = signatureOk(req, account.provider, authToken, url, params);
  if (ok) return;
  logger.warn(
    { path: req.path, provider: account.provider, mode: env.TELEPHONY_SIGNATURE_MODE, hasHeader },
    `${account.provider === 'TWILIO' ? 'Twilio' : 'Plivo'} signature mismatch`,
  );
  if (env.TELEPHONY_SIGNATURE_MODE === 'enforce') throw forbidden('Bad carrier signature');
}
