import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

interface FakeUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  googleId: string | null;
  role: 'SUBSCRIBER' | 'ADMIN' | 'SUPER_ADMIN';
  workspaceId: string | null;
  timezone: string;
  suspended: boolean;
  lastLoginAt: Date | null;
}
type Data = Record<string, unknown>;

// Google is configured for this file, and the database is an in-memory fake.
const db = vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = '1234-abc.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  const users: FakeUser[] = [];
  const workspaces: Array<{ id: string; name: string }> = [];
  const audits: Data[] = [];
  let seq = 0;
  const find = (where: Data) =>
    users.find((u) => Object.entries(where).every(([k, v]) => u[k as keyof FakeUser] === v));
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: Data }) => find(where) ?? null,
      findUniqueOrThrow: async ({ where }: { where: Data }) => {
        const user = find(where);
        if (!user) throw new Error('not found');
        return user;
      },
      update: async ({ where, data }: { where: Data; data: Data }) =>
        Object.assign(find(where)!, data),
      create: async ({ data }: { data: Data }) => {
        if (users.some((u) => u.email === data.email)) throw new Error('unique email');
        const user = {
          id: `u${++seq}`,
          googleId: null,
          timezone: 'UTC',
          suspended: false,
          lastLoginAt: null,
          ...data,
        } as FakeUser;
        users.push(user);
        return user;
      },
    },
    workspace: {
      create: async ({ data }: { data: { name: string } }) => {
        const ws = { id: `w${++seq}`, ...data };
        workspaces.push(ws);
        return ws;
      },
    },
    session: {
      create: async ({ data }: { data: Data }) => ({ id: `s${++seq}`, ...data }),
      updateMany: async () => ({ count: 0 }),
    },
    auditLog: { create: async ({ data }: { data: Data }) => audits.push(data) },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
  };
  return { users, workspaces, audits, prisma };
});
vi.mock('../src/lib/prisma', () => ({ prisma: db.prisma }));

import {
  hashPassword,
  hasUsablePassword,
  unusablePasswordHash,
  verifyPassword,
} from '../src/lib/password';
import { signState } from '../src/lib/signed-url';
import { decodeIdTokenPayload } from '../src/services/google-calendar';
import {
  GoogleIdTokenError,
  parseIntent,
  readGoogleState,
  safeNextPath,
  signGoogleState,
  validateIdTokenClaims,
} from '../src/services/google-auth';
import { authRouter } from '../src/modules/auth';
import { errorHandler } from '../src/middleware/error';

const CLIENT_ID = '1234-abc.apps.googleusercontent.com';
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const nowSec = Math.floor(NOW / 1000);

function jwt(payload: Record<string, unknown>): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: '110169484474386276334',
    email: 'Ada.Lovelace@Example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    given_name: 'Ada',
    family_name: 'Lovelace',
    iat: nowSec - 10,
    exp: nowSec + 3590,
    ...overrides,
  };
}

const validate = (c: Record<string, unknown> | null) =>
  validateIdTokenClaims(c, { clientId: CLIENT_ID, nowMs: NOW });

describe('Google sign-in: next path', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/dashboard/billing?plan=PRO')).toBe('/dashboard/billing?plan=PRO');
    expect(safeNextPath('/admin/workspaces#top')).toBe('/admin/workspaces#top');
  });

  it('rejects anything that could leave the site', () => {
    for (const bad of [
      '//evil.com',
      '//evil.com/dashboard',
      '/\\evil.com',
      '\\\\evil.com',
      'https://evil.com',
      'javascript:alert(1)',
      'dashboard',
      '/\t/evil.com',
      '/\n/evil.com',
      '',
      '/' + 'a'.repeat(600),
    ]) {
      expect(safeNextPath(bad), bad).toBeNull();
    }
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(['/dashboard'])).toBeNull();
    expect(safeNextPath({ path: '/dashboard' })).toBeNull();
  });

  it('defaults the intent to login', () => {
    expect(parseIntent('signup')).toBe('signup');
    expect(parseIntent('login')).toBe('login');
    expect(parseIntent('admin')).toBe('login');
    expect(parseIntent(undefined)).toBe('login');
  });
});

describe('Google sign-in: state', () => {
  it('round-trips intent and next for the browser that started it', () => {
    const state = signGoogleState({ intent: 'signup', next: '/dashboard/billing?plan=PRO' }, 'n1');
    expect(readGoogleState(state, 'n1')).toEqual({
      intent: 'signup',
      next: '/dashboard/billing?plan=PRO',
    });
    expect(readGoogleState(signGoogleState({ intent: 'login', next: null }, 'n2'), 'n2')).toEqual({
      intent: 'login',
      next: null,
    });
  });

  it('rejects a missing or different nonce cookie (login CSRF)', () => {
    const state = signGoogleState({ intent: 'login', next: null }, 'nonce-a');
    expect(readGoogleState(state, undefined)).toBeNull();
    expect(readGoogleState(state, '')).toBeNull();
    expect(readGoogleState(state, 'nonce-b')).toBeNull();
  });

  it('rejects tampered, expired and other flows’ states', () => {
    const state = signGoogleState({ intent: 'login', next: '/dashboard' }, 'n');
    const [body, sig] = state.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body!, 'base64url').toString()),
        next: '//evil.com',
      }),
    ).toString('base64url');
    expect(readGoogleState(`${forged}.${sig}`, 'n')).toBeNull();
    expect(
      readGoogleState(
        state.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')),
        'n',
      ),
    ).toBeNull();
    expect(readGoogleState('garbage', 'n')).toBeNull();
    expect(readGoogleState(undefined, 'n')).toBeNull();
    // A Google Calendar connect state is signed with the same key but is not a sign-in.
    expect(
      readGoogleState(signState({ workspaceId: 'w1', userId: 'u1', nonce: 'n' }), 'n'),
    ).toBeNull();
    // Expired.
    expect(
      readGoogleState(
        signState({ purpose: 'google_signin', intent: 'login', next: '', nonce: 'n' }, -1),
        'n',
      ),
    ).toBeNull();
  });

  it('re-sanitises next even inside a validly signed state', () => {
    const state = signState({
      purpose: 'google_signin',
      intent: 'login',
      next: '//evil.com',
      nonce: 'n',
    });
    expect(readGoogleState(state, 'n')).toEqual({ intent: 'login', next: null });
  });
});

describe('Google sign-in: id_token claims', () => {
  it('decodes a JWT payload and accepts a valid Google token', () => {
    const decoded = decodeIdTokenPayload(jwt(claims()));
    expect(decoded?.sub).toBe('110169484474386276334');
    expect(validate(decoded)).toEqual({
      sub: '110169484474386276334',
      email: 'ada.lovelace@example.com',
      name: 'Ada Lovelace',
      firstName: 'Ada',
    });
    expect(validate(claims({ iss: 'accounts.google.com' })).sub).toBe('110169484474386276334');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeIdTokenPayload('not-a-jwt')).toBeNull();
    expect(decodeIdTokenPayload('a.b')).toBeNull();
    expect(decodeIdTokenPayload('a.!!!.c')).toBeNull();
    expect(decodeIdTokenPayload(`a.${Buffer.from('[1,2]').toString('base64url')}.c`)).toBeNull();
    expect(() => validate(null)).toThrow(GoogleIdTokenError);
  });

  it('checks the audience', () => {
    expect(() => validate(claims({ aud: 'someone-else.apps.googleusercontent.com' }))).toThrow(
      /audience/,
    );
    expect(() => validate(claims({ aud: undefined }))).toThrow(/audience/);
    expect(validate(claims({ aud: [CLIENT_ID, 'other'], azp: CLIENT_ID })).email).toBe(
      'ada.lovelace@example.com',
    );
    expect(() => validate(claims({ aud: [CLIENT_ID, 'other'], azp: 'other' }))).toThrow(/audience/);
    expect(() => validateIdTokenClaims(claims({ aud: '' }), { clientId: '', nowMs: NOW })).toThrow(
      /audience/,
    );
  });

  it('checks the issuer', () => {
    expect(() => validate(claims({ iss: 'https://evil.example.com' }))).toThrow(/issuer/);
    expect(() => validate(claims({ iss: undefined }))).toThrow(/issuer/);
  });

  it('checks expiry, with a minute of clock skew', () => {
    expect(() => validate(claims({ exp: nowSec - 3600 }))).toThrow(/expired/);
    expect(() => validate(claims({ exp: nowSec - 61 }))).toThrow(/expired/);
    expect(() => validate(claims({ exp: String(nowSec + 3600) }))).toThrow(/expired/);
    expect(() => validate(claims({ exp: undefined }))).toThrow(/expired/);
    expect(validate(claims({ exp: nowSec - 30 })).sub).toBeTruthy();
  });

  it('requires a verified email and a subject', () => {
    expect(() => validate(claims({ email_verified: false }))).toThrow(/not verified/);
    expect(() => validate(claims({ email_verified: undefined }))).toThrow(/not verified/);
    expect(() => validate(claims({ email_verified: 'false' }))).toThrow(/not verified/);
    expect(validate(claims({ email_verified: 'true' })).email).toBe('ada.lovelace@example.com');
    expect(() => validate(claims({ email: undefined }))).toThrow(/email/);
    expect(() => validate(claims({ email: 'not-an-email' }))).toThrow(/email/);
    expect(() => validate(claims({ sub: '' }))).toThrow(/subject/);
    expect(() => validate(claims({ sub: 42 }))).toThrow(/subject/);
  });

  it('derives a display name and first name when the profile is sparse', () => {
    expect(validate(claims({ name: undefined, given_name: undefined }))).toMatchObject({
      name: 'Lovelace',
      firstName: 'Lovelace',
    });
    expect(
      validate(claims({ name: undefined, given_name: undefined, family_name: undefined })),
    ).toMatchObject({ name: 'ada.lovelace', firstName: 'ada.lovelace' });
    expect(validate(claims({ name: 'Grace Hopper', given_name: undefined }))).toMatchObject({
      name: 'Grace Hopper',
      firstName: 'Grace',
    });
  });
});

describe('Google sign-in: accounts without a password', () => {
  it('stores a marker that no password matches', async () => {
    const marker = unusablePasswordHash();
    expect(marker.startsWith('google$')).toBe(true);
    expect(unusablePasswordHash()).not.toBe(marker);
    expect(hasUsablePassword(marker)).toBe(false);
    await expect(verifyPassword('', marker)).resolves.toBe(false);
    await expect(verifyPassword(marker, marker)).resolves.toBe(false);
    await expect(verifyPassword(marker.slice('google$'.length), marker)).resolves.toBe(false);
  });

  it('treats real hashes as usable and unknown formats as non-matching', async () => {
    const hash = await hashPassword('correct-horse-9');
    expect(hasUsablePassword(hash)).toBe(true);
    await expect(verifyPassword('correct-horse-9', hash)).resolves.toBe(true);
    await expect(verifyPassword('anything', 'bcrypt$2b$10$abc')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });
});

describe('Google sign-in: routes', () => {
  const APP = 'http://localhost:3000';
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);

  let tokenEndpoint: { status: number; body: Data } = { status: 500, body: {} };
  const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
    Response.json(tokenEndpoint.body, { status: tokenEndpoint.status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const fresh = () => Math.floor(Date.now() / 1000) + 3600;

  /** What Google's token endpoint answers next. */
  function googleSays(overrides: Record<string, unknown> = {}) {
    tokenEndpoint = {
      status: 200,
      body: {
        access_token: 'ya29.x',
        expires_in: 3599,
        id_token: jwt(claims({ exp: fresh(), ...overrides })),
      },
    };
  }

  const setCookies = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  /** Cookies the response sets (not the ones it clears). */
  const cookieNames = (res: request.Response) =>
    setCookies(res)
      .filter((c) => !/Expires=Thu, 01 Jan 1970/.test(c))
      .map((c) => c.split('=')[0]);

  async function start(query = '?intent=login') {
    const res = await request(app).get(`/api/auth/google${query}`);
    expect(res.status).toBe(302);
    const nonce = setCookies(res).find((c) => c.startsWith('pv_google_nonce=')) ?? '';
    const location = new URL(res.headers.location as string);
    return { location, state: location.searchParams.get('state'), nonce };
  }

  function callback(state: string | null, nonce: string, query: Data = { code: '4/0Abc' }) {
    const req = request(app)
      .get('/api/auth/google/callback')
      .query({ state, ...query });
    return nonce ? req.set('Cookie', nonce.split(';')[0]!) : req;
  }

  async function signIn(query = '?intent=login', overrides: Record<string, unknown> = {}) {
    const { state, nonce } = await start(query);
    googleSays(overrides);
    return callback(state, nonce);
  }

  function addUser(user: Partial<FakeUser>) {
    db.users.push({
      id: `existing${db.users.length}`,
      email: 'ada.lovelace@example.com',
      name: 'Ada',
      passwordHash: 'scrypt$32768$8$1$c2FsdA==$aGFzaA==',
      googleId: null,
      role: 'SUBSCRIBER',
      workspaceId: 'w-existing',
      timezone: 'UTC',
      suspended: false,
      lastLoginAt: null,
      ...user,
    });
  }

  beforeEach(() => {
    db.users.length = 0;
    db.workspaces.length = 0;
    db.audits.length = 0;
    fetchMock.mockClear();
  });

  it('reports Google as available', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.body).toEqual({ google: true });
  });

  it('sends the browser to Google with a signed state and a nonce cookie', async () => {
    const { location, state, nonce } = await start('?intent=signup&next=%2F%2Fevil.com');
    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: `${APP}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
    expect(nonce).toMatch(/HttpOnly/i);
    expect(nonce).toMatch(/Path=\/api\/auth\/google/);
    expect(nonce).toMatch(/SameSite=Lax/i);
    const nonceValue = nonce.split(';')[0]!.split('=')[1];
    expect(readGoogleState(state, nonceValue)).toEqual({ intent: 'signup', next: null });
  });

  it('creates a subscriber with their own workspace on first sign-in', async () => {
    const res = await signIn('?intent=signup&next=%2Fdashboard%2Fbilling%3Fplan%3DPRO');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${APP}/dashboard/billing?plan=PRO`);
    expect(cookieNames(res)).toEqual(expect.arrayContaining(['pv_at', 'pv_rt', 'pv_role']));

    const init = fetchMock.mock.calls[0]?.[1];
    const sent = new URLSearchParams(init?.body as URLSearchParams);
    expect(sent.get('redirect_uri')).toBe(`${APP}/api/auth/google/callback`);
    expect(sent.get('code')).toBe('4/0Abc');
    expect(sent.get('grant_type')).toBe('authorization_code');

    expect(db.users).toHaveLength(1);
    const user = db.users[0]!;
    expect(user).toMatchObject({
      email: 'ada.lovelace@example.com',
      name: 'Ada Lovelace',
      googleId: '110169484474386276334',
      role: 'SUBSCRIBER',
      workspaceId: db.workspaces[0]?.id,
    });
    expect(hasUsablePassword(user.passwordHash)).toBe(false);
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(db.workspaces[0]?.name).toBe("Ada's workspace");
    expect(db.audits).toEqual([
      expect.objectContaining({ action: 'auth.register', meta: { via: 'google' } }),
    ]);
  });

  it('links an existing email account, then finds it by Google id', async () => {
    addUser({});
    const first = await signIn();
    expect(first.headers.location).toBe(`${APP}/dashboard`);
    expect(db.users).toHaveLength(1);
    expect(db.users[0]?.googleId).toBe('110169484474386276334');
    expect(db.audits[0]).toMatchObject({
      action: 'auth.google_login',
      meta: { via: 'google', linked: true },
    });

    // The Google account's email changed since: its id still finds the account.
    const second = await signIn('?intent=login', { email: 'ada@new.example.com' });
    expect(second.headers.location).toBe(`${APP}/dashboard`);
    expect(db.users).toHaveLength(1);
    expect(db.audits[1]).toMatchObject({ action: 'auth.google_login', meta: { via: 'google' } });
  });

  it('sends staff to /admin by default and honours a safe next', async () => {
    addUser({ role: 'ADMIN', workspaceId: null });
    expect((await signIn()).headers.location).toBe(`${APP}/admin`);
    expect((await signIn('?next=%2Fadmin%2Fsupport')).headers.location).toBe(
      `${APP}/admin/support`,
    );
  });

  it('refuses suspended accounts and emails linked to another Google account', async () => {
    addUser({ suspended: true });
    let res = await signIn();
    expect(res.headers.location).toBe(`${APP}/login?error=suspended`);
    expect(db.users[0]?.googleId).toBeNull();
    expect(cookieNames(res)).not.toContain('pv_at');

    db.users[0]!.suspended = false;
    db.users[0]!.googleId = 'some-other-google-account';
    res = await signIn();
    expect(res.headers.location).toBe(`${APP}/login?error=google`);
    expect(cookieNames(res)).not.toContain('pv_at');
  });

  it('fails closed on bad tokens, a rejected code and a missing nonce cookie', async () => {
    for (const overrides of [
      { aud: 'someone-else.apps.googleusercontent.com' },
      { iss: 'https://evil.example.com' },
      { email_verified: false },
      { exp: Math.floor(Date.now() / 1000) - 3600 },
    ]) {
      const { state, nonce } = await start();
      googleSays();
      tokenEndpoint.body.id_token = jwt(claims({ exp: fresh(), ...overrides }));
      const res = await callback(state, nonce);
      expect(res.headers.location, JSON.stringify(overrides)).toBe(`${APP}/login?error=google`);
    }

    const noCookie = await start();
    googleSays();
    expect((await callback(noCookie.state, '')).headers.location).toBe(`${APP}/login?error=google`);

    const rejected = await start();
    tokenEndpoint = { status: 400, body: { error: 'invalid_grant' } };
    expect((await callback(rejected.state, rejected.nonce)).headers.location).toBe(
      `${APP}/login?error=google`,
    );

    expect(db.users).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  it('returns to the signup page when the user cancels at Google', async () => {
    const { state, nonce } = await start('?intent=signup');
    const res = await callback(state, nonce, { error: 'access_denied' });
    expect(res.headers.location).toBe(`${APP}/signup`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a Google-created account set a first password without a current one', async () => {
    const res = await signIn();
    const access = setCookies(res)
      .find((c) => c.startsWith('pv_at='))!
      .split(';')[0]!;
    const change = (body: Data) =>
      request(app).post('/api/auth/change-password').set('Cookie', access).send(body);

    expect((await change({ newPassword: 'first-password-1' })).status).toBe(200);
    expect(await verifyPassword('first-password-1', db.users[0]!.passwordHash)).toBe(true);
    expect(db.audits.at(-1)).toMatchObject({ action: 'auth.password_set' });

    // From now on the current password is required.
    expect((await change({ newPassword: 'second-password-2' })).status).toBe(400);
    expect(
      (await change({ currentPassword: 'wrong-password-0', newPassword: 'second-password-2' }))
        .status,
    ).toBe(400);
    expect(
      (await change({ currentPassword: 'first-password-1', newPassword: 'second-password-2' }))
        .status,
    ).toBe(200);
    expect(db.audits.at(-1)).toMatchObject({ action: 'auth.password_changed' });
  });
});
