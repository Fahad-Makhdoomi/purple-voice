'use client';

import { COOKIE_POLICY_VERSION } from '@pv/shared';

/**
 * The visitor's cookie choices, kept in the first-party `pv_consent` cookie
 * (strictly necessary: it only remembers the choice) for 12 months, and
 * recorded once per change at /api/public/consent for accountability.
 * Nothing optional runs until a choice is stored; a new policy version asks
 * again. A Global Privacy Control signal always turns marketing off.
 */

export interface Consent {
  v: string;
  id: string;
  analytics: boolean;
  marketing: boolean;
  at: number;
}

const COOKIE = 'pv_consent';
const MAX_AGE = 60 * 60 * 24 * 365;
const EVENT = 'pv:consent';
const OPEN_EVENT = 'pv:cookie-settings';

export function gpcEnabled(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw)) as Consent;
    if (c.v !== COOKIE_POLICY_VERSION || typeof c.id !== 'string') return null;
    return gpcEnabled() ? { ...c, marketing: false } : c;
  } catch {
    return null;
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stores a choice, tells the page, and records it. */
export function saveConsent(choice: { analytics: boolean; marketing: boolean }): Consent {
  const gpc = gpcEnabled();
  const consent: Consent = {
    v: COOKIE_POLICY_VERSION,
    id: readConsent()?.id ?? newId(),
    analytics: choice.analytics,
    marketing: choice.marketing && !gpc,
    at: Date.now(),
  };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  if (!consent.analytics) clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent<Consent>(EVENT, { detail: consent }));
  void fetch('/api/public/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentId: consent.id,
      preferences: false,
      analytics: consent.analytics,
      marketing: consent.marketing,
      gpc,
      policyVersion: COOKIE_POLICY_VERSION,
    }),
    keepalive: true,
  }).catch(() => undefined);
  return consent;
}

/** Removes Google Analytics cookies when analytics consent is refused or withdrawn. */
function clearAnalyticsCookies() {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0] ?? '';
    if (name === '_ga' || name.startsWith('_ga_') || name === '_gid') {
      for (const d of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`;
      }
    }
  }
}

export function onConsentChange(fn: (c: Consent) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Consent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Opens the cookie preferences (footer link, privacy choices page). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenCookieSettings(fn: () => void): () => void {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}
