import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

interface FakeSession {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

// The session table is an in-memory fake.
const db = vi.hoisted(() => {
  const user = {
    id: 'u1',
    email: 'ada@example.com',
    name: 'Ada',
    role: 'SUBSCRIBER',
    workspaceId: 'w1',
    timezone: 'UTC',
    suspended: false,
  };
  const sessions: FakeSession[] = [];
  let seq = 0;
  const prisma = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const s = sessions.find((x) => x.tokenHash === where.tokenHash);
        return s ? { ...s, user } : null;
      },
      create: async ({ data }: { data: Omit<FakeSession, 'id' | 'revokedAt' | 'replacedBy'> }) => {
        const s = { id: `s${++seq}`, revokedAt: null, replacedBy: null, ...data };
        sessions.push(s);
        return s;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeSession> }) =>
        Object.assign(
          sessions.find((x) => x.id === where.id)!,
          data,
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: { familyId: string; revokedAt: null };
        data: Partial<FakeSession>;
      }) => {
        const hit = sessions.filter((x) => x.familyId === where.familyId && !x.revokedAt);
        hit.forEach((x) => Object.assign(x, data));
        return { count: hit.length };
      },
    },
  };
  return { user, sessions, prisma };
});
vi.mock('../src/lib/prisma', () => ({ prisma: db.prisma }));

import { REFRESH_REUSE_GRACE_MS, refreshVerdict } from '../src/lib/refresh-token';
import { sha256 } from '../src/lib/crypto';
import { authRouter } from '../src/modules/auth';
import { errorHandler } from '../src/middleware/error';

const now = new Date('2026-10-22T12:00:00Z');
const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('refresh token rotation', () => {
  it('rotates a current token', () => {
    expect(refreshVerdict({ expiresAt: later, revokedAt: null, replacedBy: null }, now)).toBe(
      'rotate',
    );
  });

  it('lets a second tab refresh with the token another tab just rotated', () => {
    const session = { expiresAt: later, revokedAt: ago(800), replacedBy: 'next' };
    expect(refreshVerdict(session, now)).toBe('concurrent');
    expect(refreshVerdict({ ...session, revokedAt: ago(REFRESH_REUSE_GRACE_MS) }, now)).toBe(
      'concurrent',
    );
  });

  it('treats a token rotated a while ago as stolen', () => {
    expect(
      refreshVerdict(
        { expiresAt: later, revokedAt: ago(REFRESH_REUSE_GRACE_MS + 1), replacedBy: 'next' },
        now,
      ),
    ).toBe('reused');
  });

  it('never renews a signed-out token, however recent', () => {
    expect(refreshVerdict({ expiresAt: later, revokedAt: ago(10), replacedBy: null }, now)).toBe(
      'reused',
    );
  });

  it('asks for a new sign-in when the token is unknown or expired', () => {
    expect(refreshVerdict(null, now)).toBe('expired');
    expect(refreshVerdict({ expiresAt: ago(1), revokedAt: null, replacedBy: null }, now)).toBe(
      'expired',
    );
  });
});

describe('POST /api/auth/refresh', () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);

  /** A signed-in browser: one live refresh token in a fresh family. */
  function signIn(token: string, family: string) {
    db.sessions.push({
      id: `start-${family}`,
      userId: db.user.id,
      tokenHash: sha256(token),
      familyId: family,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      replacedBy: null,
    });
  }
  const refresh = (token: string) =>
    request(app).post('/api/auth/refresh').set('Cookie', `pv_rt=${token}`);
  const live = (family: string) =>
    db.sessions.filter((s) => s.familyId === family && !s.revokedAt).length;

  it('keeps both tabs signed in when they refresh at the same moment', async () => {
    signIn('tab-token', 'f1');
    const [a, b] = await Promise.all([refresh('tab-token'), refresh('tab-token')]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // And once more straight after, as a tab that was slower still would.
    expect((await refresh('tab-token')).status).toBe(200);
    expect(live('f1')).toBeGreaterThan(0);
    expect(String(a.headers['set-cookie'])).toContain('pv_rt=');
  });

  it('still ends every session when an old rotated token comes back', async () => {
    signIn('old-token', 'f2');
    expect((await refresh('old-token')).status).toBe(200);
    db.sessions.find((s) => s.tokenHash === sha256('old-token'))!.revokedAt = new Date(
      Date.now() - REFRESH_REUSE_GRACE_MS - 5_000,
    );
    expect((await refresh('old-token')).status).toBe(401);
    expect(live('f2')).toBe(0);
  });

  it('does not bring back a session that signed out', async () => {
    signIn('gone-token', 'f3');
    db.sessions.find((s) => s.tokenHash === sha256('gone-token'))!.revokedAt = new Date();
    expect((await refresh('gone-token')).status).toBe(401);
  });
});
