import { promises as dns } from 'node:dns';
import disposableList from '../data/disposable-domains.json';
import { env } from '../config/env';
import { badRequest } from '../lib/http-error';
import { logger } from '../lib/logger';

/**
 * Keeps throwaway inboxes out of sign-up. Three checks:
 * 1. the community blocklist of disposable-email domains
 *    (github.com/disposable-email-domains, vendored in data/disposable-domains.json),
 *    matched on the domain and every parent domain;
 * 2. extra domains a super admin blocks (Admin → Email automations);
 * 3. the domain must accept mail at all (an MX record, or an A/AAAA record
 *    as RFC 5321 allows). DNS trouble on our side lets the address through.
 */

const DISPOSABLE = new Set<string>(disposableList as string[]);

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase().replace(/\.$/, '');
}

function candidates(domain: string): string[] {
  const parts = domain.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'));
  return out;
}

export function isDisposableDomain(domain: string, extra: readonly string[] = []): boolean {
  const extraSet = new Set(extra.map((d) => d.trim().toLowerCase()).filter(Boolean));
  return candidates(domain).some((d) => DISPOSABLE.has(d) || extraSet.has(d));
}

const DNS_TIMEOUT_MS = 4_000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS),
    ),
  ]);
}

const NO_SUCH = new Set(['ENOTFOUND', 'ENODATA', 'ENONAME', 'NXDOMAIN']);

/** false only when DNS says the domain cannot receive mail. */
export async function domainAcceptsMail(domain: string): Promise<boolean> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    // RFC 7505 "null MX": the domain says it takes no mail.
    if (mx.length === 1 && mx[0].exchange === '' ) return false;
    if (mx.length) return true;
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (!NO_SUCH.has(code)) {
      logger.warn({ err, domain }, 'MX lookup failed; letting the address through');
      return true;
    }
  }
  try {
    const a = await withTimeout(dns.resolve(domain));
    return a.length > 0;
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    return !NO_SUCH.has(code);
  }
}

/** Throws a 400 with a friendly message when the address can't be used to sign up. */
export async function assertSignupEmail(email: string, extraBlocked: readonly string[] = []) {
  const domain = emailDomain(email);
  if (isDisposableDomain(domain, extraBlocked))
    throw badRequest(
      'Temporary or disposable email addresses can’t be used. Please sign up with your work or personal email.',
    );
  if (env.isTest) return;
  if (!(await domainAcceptsMail(domain)))
    throw badRequest('That email domain can’t receive email. Please check the address.');
}
