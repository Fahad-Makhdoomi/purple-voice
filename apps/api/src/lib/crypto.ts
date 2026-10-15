import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * AES-256-GCM for secrets at rest (AI keys, telephony tokens, OAuth tokens).
 * Format: v1.<iv>.<tag>.<ciphertext>, each part base64url. The version prefix
 * leaves room to rotate the key or algorithm without a flag day.
 */

const KEY = (() => {
  const buf = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
  if (buf.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)');
  }
  return buf;
})();

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ct] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised ciphertext format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function last4(secret: string): string {
  return secret.slice(-4);
}
