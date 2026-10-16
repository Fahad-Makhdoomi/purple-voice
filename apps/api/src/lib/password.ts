import crypto from 'node:crypto';
import { promisify } from 'node:util';

/**
 * scrypt from Node's standard library: memory-hard, no native addon to
 * compile on the VPS. Stored as scrypt$N$r$p$salt$hash so the cost can be
 * raised later and old hashes still verify.
 */

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const N = 2 ** 15;
const r = 8;
const p = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

/**
 * Accounts created through "Continue with Google" have no password. They
 * store this marker plus random bytes instead of a hash: it is not a scrypt
 * record, so `verifyPassword` rejects every password against it, and it lets
 * the account settings offer "set a password" without asking for a current one.
 */
const NO_PASSWORD_PREFIX = 'google$';

export function unusablePasswordHash(): string {
  return `${NO_PASSWORD_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

/** False for accounts that have never set a password (Google sign-up). */
export function hasUsablePassword(stored: string): boolean {
  return !stored.startsWith(NO_PASSWORD_PREFIX);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, rr, pp, saltB64, hashB64] = stored.split('$');
  // Unknown formats, including the no-password marker above, never match.
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
