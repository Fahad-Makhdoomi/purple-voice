import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { safeEqual } from '../lib/crypto';
import { unusablePasswordHash } from '../lib/password';
import { signState, verifyState } from '../lib/signed-url';
import { decodeIdTokenPayload, exchangeGoogleCode } from './google-calendar';

/**
 * "Continue with Google": OpenID Connect sign-in and sign-up with the same
 * OAuth client as the Calendar connection, asking only for openid/email/profile.
 *
 * The round trip carries a signed state (intent, where to land afterwards and
 * a nonce) and the nonce also sits in a short-lived cookie, so a callback only
 * completes in the browser that started it (no login CSRF).
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_SIGNIN_SCOPES = ['openid', 'email', 'profile'];
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const STATE_PURPOSE = 'google_signin';
export const GOOGLE_STATE_TTL_SEC = 10 * 60;
/** Tolerated clock difference between Google and this server when checking `exp`. */
const CLOCK_SKEW_SEC = 60;

export type GoogleIntent = 'login' | 'signup';

export interface GoogleSignInState {
  intent: GoogleIntent;
  /** Same-site path to land on, or null for the role's home page. */
  next: string | null;
}

export interface GoogleIdentity {
  sub: string;
  /** Lowercased; Google has verified it. */
  email: string;
  name: string;
  firstName: string;
}

export class GoogleIdTokenError extends Error {}

export function parseIntent(value: unknown): GoogleIntent {
  return value === 'signup' ? 'signup' : 'login';
}

/**
 * Only same-site relative paths are honoured as a post-sign-in destination:
 * must start with `/`, never `//` or a backslash (browsers read `/\host` as
 * `//host`), no control characters, and must resolve to our own origin.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  const base = 'https://purplevoice.invalid';
  try {
    return new URL(value, base).origin === base ? value : null;
  } catch {
    return null;
  }
}

export function signGoogleState(state: GoogleSignInState, nonce: string): string {
  return signState(
    { purpose: STATE_PURPOSE, intent: state.intent, next: state.next ?? '', nonce },
    GOOGLE_STATE_TTL_SEC,
  );
}

/**
 * The state from the callback, or null when it is forged, expired, meant for
 * another flow (e.g. the Calendar connection), or was started in a different
 * browser (`nonce` is the value of the cookie set when the flow began).
 */
export function readGoogleState(raw: unknown, nonce: unknown): GoogleSignInState | null {
  const data = verifyState<{ purpose: string; intent: string; next: string; nonce: string }>(raw);
  if (!data || data.purpose !== STATE_PURPOSE) return null;
  if (typeof nonce !== 'string' || !nonce || typeof data.nonce !== 'string') return null;
  if (!safeEqual(data.nonce, nonce)) return null;
  return { intent: parseIntent(data.intent), next: safeNextPath(data.next) };
}

/**
 * Must be listed under "Authorised redirect URIs" in Google Cloud Console.
 * It is on the website's origin (nginx, or the Next dev rewrite, forwards
 * /api to the API) rather than PUBLIC_API_URL, because the session cookies
 * set by the callback have to belong to the site the user is signing in to.
 */
export function googleSignInRedirectUri(): string {
  return `${env.appUrl}/api/auth/google/callback`;
}

export function googleSignInUrl(state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', googleSignInRedirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GOOGLE_SIGNIN_SCOPES.join(' '));
  u.searchParams.set('prompt', 'select_account');
  u.searchParams.set('state', state);
  return u.toString();
}

function claimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Checks the claims of an id_token received straight from Google's token
 * endpoint over TLS, where OIDC Core 3.1.3.7 allows skipping the signature
 * check: it must be for our client, issued by Google, unexpired, and carry a
 * verified email.
 */
export function validateIdTokenClaims(
  claims: Record<string, unknown> | null,
  opts: { clientId: string; nowMs?: number },
): GoogleIdentity {
  if (!claims) throw new GoogleIdTokenError('id_token is not a JWT');
  const now = Math.floor((opts.nowMs ?? Date.now()) / 1000);

  const { aud } = claims;
  const audOk =
    typeof aud === 'string'
      ? aud === opts.clientId
      : Array.isArray(aud) && aud.includes(opts.clientId) && claims.azp === opts.clientId;
  if (!opts.clientId || !audOk) throw new GoogleIdTokenError('id_token audience mismatch');
  if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss))
    throw new GoogleIdTokenError('id_token issuer is not Google');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SEC <= now)
    throw new GoogleIdTokenError('id_token has expired');

  const sub = claimString(claims.sub);
  if (!sub || sub.length > 255) throw new GoogleIdTokenError('id_token has no subject');
  const email = claimString(claims.email)?.toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email))
    throw new GoogleIdTokenError('id_token has no email');
  // Google sends a boolean; very old tokens used the string "true".
  if (claims.email_verified !== true && claims.email_verified !== 'true')
    throw new GoogleIdTokenError('Google email address is not verified');

  const local = email.split('@')[0]!;
  const given = claimString(claims.given_name);
  const fullName =
    claimString(claims.name) ??
    ([given, claimString(claims.family_name)].filter(Boolean).join(' ') || null);
  const name = (fullName && fullName.length >= 2 ? fullName : local).slice(0, 120);
  const firstName = (given ?? name.split(' ')[0] ?? local).slice(0, 60);
  return { sub, email, name, firstName };
}

/** Exchanges the callback's code and returns who signed in. */
export async function googleIdentityFromCode(code: string): Promise<GoogleIdentity> {
  const { idToken } = await exchangeGoogleCode(code, googleSignInRedirectUri());
  if (!idToken) throw new GoogleIdTokenError('Google returned no id_token');
  return validateIdTokenClaims(decodeIdTokenPayload(idToken), {
    clientId: env.GOOGLE_CLIENT_ID ?? '',
  });
}

export type GoogleAccountResult =
  | { kind: 'signed_in'; user: User; linked: boolean }
  | { kind: 'created'; user: User }
  | { kind: 'suspended' }
  /** The email's account is already linked to a different Google account. */
  | { kind: 'conflict' };

/**
 * Finds the account for a Google identity: by Google id, else by email (and
 * links it), else creates a subscriber with their own workspace, the same as
 * /register. New accounts get an unusable password; they can set one from
 * account settings or with "Forgot password".
 */
export async function resolveGoogleAccount(identity: GoogleIdentity): Promise<GoogleAccountResult> {
  const now = new Date();

  const byGoogle = await prisma.user.findUnique({ where: { googleId: identity.sub } });
  if (byGoogle) {
    if (byGoogle.suspended) return { kind: 'suspended' };
    const user = await prisma.user.update({
      where: { id: byGoogle.id },
      data: { lastLoginAt: now },
    });
    return { kind: 'signed_in', user, linked: false };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    if (byEmail.suspended) return { kind: 'suspended' };
    if (byEmail.googleId) return { kind: 'conflict' };
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: identity.sub, lastLoginAt: now },
    });
    return { kind: 'signed_in', user, linked: true };
  }

  const user = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name: `${identity.firstName}'s workspace` },
    });
    return tx.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        passwordHash: unusablePasswordHash(),
        googleId: identity.sub,
        role: 'SUBSCRIBER',
        workspaceId: workspace.id,
        lastLoginAt: now,
      },
    });
  });
  return { kind: 'created', user };
}
