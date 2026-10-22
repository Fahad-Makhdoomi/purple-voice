import { Router, type CookieOptions, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  LEGAL_VERSION,
  acceptTermsSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  homePathForRole,
  isStaff,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@pv/shared';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { hashPassword, hasUsablePassword, verifyPassword } from '../lib/password';
import { randomToken, sha256 } from '../lib/crypto';
import { signAccessToken } from '../lib/jwt';
import { refreshVerdict } from '../lib/refresh-token';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/http-error';
import { sendMail } from '../lib/mailer';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';
import { ACCESS_COOKIE, REFRESH_COOKIE, authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { getEntitlements, getUsage } from '../services/entitlements';
import { assertCaptcha } from '../services/captcha';
import {
  GOOGLE_STATE_TTL_SEC,
  googleIdentityFromCode,
  googleSignInUrl,
  parseIntent,
  readGoogleState,
  resolveGoogleAccount,
  safeNextPath,
  signGoogleState,
} from '../services/google-auth';

export const authRouter = Router();

/** Readable by the web app's middleware for routing only; never trusted for access. */
const ROLE_COOKIE = 'pv_role';
const REFRESH_PATH = '/api/auth';
/** Binds a Google sign-in round trip to the browser that started it. */
const GOOGLE_NONCE_COOKIE = 'pv_google_nonce';
const GOOGLE_PATH = '/api/auth/google';

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
  };
}

async function issueSession(req: Request, res: Response, user: User, familyId?: string) {
  const refreshToken = randomToken(48);
  const refreshMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      familyId: familyId ?? randomToken(12),
      expiresAt: new Date(Date.now() + refreshMs),
      userAgent: req.header('user-agent')?.slice(0, 300),
      ip: req.ip,
    },
  });

  const access = signAccessToken({ sub: user.id, role: user.role, wid: user.workspaceId });
  res.cookie(ACCESS_COOKIE, access, {
    ...baseCookie(),
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_MIN * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie(),
    path: REFRESH_PATH,
    maxAge: refreshMs,
  });
  res.cookie(ROLE_COOKIE, user.role, {
    ...baseCookie(),
    httpOnly: false,
    path: '/',
    maxAge: refreshMs,
  });
  return session;
}

function clearSession(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_PATH });
  res.clearCookie(ROLE_COOKIE, { ...baseCookie(), httpOnly: false, path: '/' });
}

function publicUser(
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'workspaceId' | 'timezone'>,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    timezone: user.timezone,
  };
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  await assertCaptcha(req, 'signup', input.captchaToken);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists. Try signing in.');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name: input.company?.trim() || `${input.name.split(' ')[0]}'s workspace` },
    });
    return tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: 'SUBSCRIBER',
        workspaceId: workspace.id,
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_VERSION,
        marketingOptIn: input.marketingOptIn,
      },
    });
  });

  await issueSession(req, res, user);
  await audit(req, 'auth.register', { actorId: user.id, workspaceId: user.workspaceId });
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  await assertCaptcha(req, 'login', input.captchaToken);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Verify against a dummy hash when the user doesn't exist (or has no password,
  // having signed up with Google) so response time doesn't reveal which emails
  // have accounts.
  const ok =
    user && hasUsablePassword(user.passwordHash)
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, DUMMY_HASH).then(() => false);
  if (!user || !ok) throw unauthorized('Email or password is incorrect');
  if (user.suspended) throw forbidden('This account is suspended. Please contact support.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await issueSession(req, res, user);
  res.json({ user: publicUser(user) });
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || !token) {
    clearSession(res);
    throw unauthorized();
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  const verdict = refreshVerdict(session);
  if (!session || verdict === 'expired') {
    clearSession(res);
    throw unauthorized();
  }
  if (verdict === 'reused') {
    // A token rotated a while ago came back: someone else holds a copy. Kill the family.
    await prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearSession(res);
    throw unauthorized('Session expired, please sign in again');
  }
  if (session.user.suspended) {
    clearSession(res);
    throw forbidden('This account is suspended');
  }

  const next = await issueSession(req, res, session.user, session.familyId);
  // A concurrent refresh already retired this token; the session it made stays valid too.
  if (verdict === 'rotate') {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedBy: next.id },
    });
  }
  res.json({ user: publicUser(session.user) });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === 'string' && token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: { workspace: true },
  });
  let entitlements = null;
  let usage = null;
  if (user.workspaceId) {
    entitlements = await getEntitlements(user.workspaceId);
    usage = await getUsage(user.workspaceId, entitlements);
  }
  res.json({
    user: {
      ...publicUser(user),
      googleLinked: !!user.googleId,
      hasPassword: hasUsablePassword(user.passwordHash),
      marketingOptIn: user.marketingOptIn,
      termsAcceptedAt: user.termsAcceptedAt,
      // Subscribers re-accept when the Terms or Privacy Policy change.
      needsTermsAcceptance: user.role === 'SUBSCRIBER' && user.termsVersion !== LEGAL_VERSION,
    },
    workspace: user.workspace
      ? { id: user.workspace.id, name: user.workspace.name, timezone: user.workspace.timezone }
      : null,
    entitlements,
    usage,
    staff: isStaff(user.role),
  });
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: input.name, timezone: input.timezone, marketingOptIn: input.marketingOptIn },
  });
  if (input.company && user.workspaceId && user.role === 'SUBSCRIBER') {
    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: { name: input.company, timezone: input.timezone },
    });
  }
  res.json({ user: publicUser(user) });
});

authRouter.post('/change-password', authenticate, async (req, res) => {
  const input = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  // Accounts created with Google have never had a password to confirm.
  const firstPassword = !hasUsablePassword(user.passwordHash);
  if (
    !firstPassword &&
    !(input.currentPassword && (await verifyPassword(input.currentPassword, user.passwordHash)))
  ) {
    throw badRequest('Current password is incorrect');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  // Sign out every other device.
  const current = req.cookies?.[REFRESH_COOKIE];
  await prisma.session.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
      ...(typeof current === 'string' ? { NOT: { tokenHash: sha256(current) } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  await audit(req, firstPassword ? 'auth.password_set' : 'auth.password_changed');
  res.json({ ok: true });
});

// ── Privacy rights: terms, data export, account deletion ───────────────────

authRouter.post('/accept-terms', authenticate, async (req, res) => {
  const { version } = acceptTermsSchema.parse(req.body);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { termsAcceptedAt: new Date(), termsVersion: version },
  });
  await audit(req, 'auth.terms_accepted', { meta: { version } });
  res.json({ ok: true });
});

/**
 * Everything we hold about the signed-in user and their workspace, as JSON
 * (GDPR art. 15 and 20, UK GDPR, CCPA right to know). Secrets — carrier
 * tokens, API keys, OAuth tokens — are never included, only that they exist.
 */
authRouter.get('/me/export', authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const wid = user.workspaceId;
  const scope = { where: { workspaceId: wid ?? '__none__' } };
  const [
    workspace,
    subscription,
    payments,
    agents,
    numbers,
    campaigns,
    contacts,
    calls,
    appointments,
    integrations,
    messages,
    tickets,
    sessions,
  ] = await Promise.all([
    wid ? prisma.workspace.findUnique({ where: { id: wid } }) : null,
    wid
      ? prisma.subscription.findUnique({
          where: { workspaceId: wid },
          select: {
            status: true,
            provider: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            createdAt: true,
            plan: { select: { code: true, name: true } },
          },
        })
      : null,
    prisma.payment.findMany(scope),
    prisma.agent.findMany(scope),
    prisma.phoneNumber.findMany({
      ...scope,
      select: { e164: true, friendlyName: true, inboundAgentId: true, createdAt: true },
    }),
    prisma.campaign.findMany(scope),
    prisma.campaignContact.findMany(scope),
    prisma.call.findMany({ ...scope, orderBy: { createdAt: 'desc' }, take: 20000 }),
    prisma.appointment.findMany(scope),
    prisma.integration.findMany({
      ...scope,
      select: { type: true, accountLabel: true, connectedAt: true },
    }),
    prisma.callMessage.findMany(scope),
    prisma.ticket.findMany({ ...scope, include: { messages: true } }),
    prisma.session.findMany({
      where: { userId: user.id },
      select: { createdAt: true, expiresAt: true, revokedAt: true, userAgent: true, ip: true },
    }),
  ]);
  await audit(req, 'privacy.data_exported');
  res
    .type('application/json')
    .setHeader(
      'Content-Disposition',
      `attachment; filename="purple-voice-data-${new Date().toISOString().slice(0, 10)}.json"`,
    )
    .send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          account: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            timezone: user.timezone,
            googleLinked: !!user.googleId,
            marketingOptIn: user.marketingOptIn,
            termsAcceptedAt: user.termsAcceptedAt,
            termsVersion: user.termsVersion,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          },
          sessions,
          workspace,
          subscription,
          payments,
          agents,
          phoneNumbers: numbers,
          campaigns,
          contacts,
          calls,
          appointments,
          integrations,
          messagesSentByAgents: messages,
          supportTickets: tickets,
        },
        null,
        2,
      ),
    );
});

/**
 * Erases the subscriber's account and workspace for good: agents, numbers,
 * campaigns, contacts, calls, transcripts, appointments, integrations and
 * keys (GDPR art. 17, UK GDPR, CCPA right to delete). Payment records the
 * law makes us keep stay with the payment gateway.
 */
authRouter.delete('/me', authenticate, async (req, res) => {
  const input = deleteAccountSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.role !== 'SUBSCRIBER' || !user.workspaceId)
    throw forbidden('Staff accounts are removed by a super admin.');
  if (hasUsablePassword(user.passwordHash)) {
    if (!input.password || !(await verifyPassword(input.password, user.passwordHash)))
      throw badRequest('Password is incorrect');
  }
  const workspaceId = user.workspaceId;
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (
    sub &&
    sub.provider !== 'MANUAL' &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) &&
    !sub.cancelAtPeriodEnd
  ) {
    throw badRequest('Cancel your paid plan on the Billing page first, then delete your account.');
  }
  const live = await prisma.call.count({
    where: { workspaceId, status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS'] } },
  });
  if (live) throw badRequest('A call is in progress. Try again once it has ended.');

  await audit(req, 'privacy.account_deleted', { meta: { email: sha256(user.email) } });
  // Everything customer-owned cascades from the workspace, the user included.
  await prisma.workspace.delete({ where: { id: workspaceId } });
  clearSession(res);
  void sendMail({
    to: user.email,
    subject: 'Your Purple Voice account has been deleted',
    text: `Hi ${user.name},\n\nAs you asked, your Purple Voice account and workspace have been deleted, with your agents, campaigns, contacts, call transcripts and settings. Nightly backups that still hold it are deleted within 14 days.\n\nIf you didn't ask for this, reply to this email straight away.`,
  });
  res.json({ ok: true });
});

// ── Continue with Google ────────────────────────────────────────────────────

/** Which sign-in methods the login and signup pages should offer. */
authRouter.get('/providers', (_req, res) => {
  res.json({ google: env.googleEnabled });
});

/** The callback is a browser navigation: when limited, land on the login page, not JSON. */
const googleCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, res) => res.redirect(`${env.appUrl}/login?error=rate_limited`),
});

function googleNonceCookie(): CookieOptions {
  return { ...baseCookie(), path: GOOGLE_PATH };
}

/** GET /api/auth/google?intent=login|signup&next=/path → Google's account chooser. */
authRouter.get('/google', (req, res) => {
  if (!env.googleEnabled) return res.redirect(`${env.appUrl}/login?error=google_unavailable`);
  const nonce = randomToken(24);
  res.cookie(GOOGLE_NONCE_COOKIE, nonce, {
    ...googleNonceCookie(),
    maxAge: GOOGLE_STATE_TTL_SEC * 1000,
  });
  const state = signGoogleState(
    { intent: parseIntent(req.query.intent), next: safeNextPath(req.query.next) },
    nonce,
  );
  res.redirect(googleSignInUrl(state));
});

authRouter.get('/google/callback', googleCallbackLimiter, async (req, res) => {
  const fail = (code = 'google') => res.redirect(`${env.appUrl}/login?error=${code}`);
  const nonce: unknown = req.cookies?.[GOOGLE_NONCE_COOKIE];
  res.clearCookie(GOOGLE_NONCE_COOKIE, googleNonceCookie());
  if (!env.googleEnabled) return fail('google_unavailable');

  const state = readGoogleState(req.query.state, nonce);
  if (!state) return fail();
  // The user closed the consent screen: back where they came from, no error.
  if (req.query.error === 'access_denied')
    return res.redirect(`${env.appUrl}/${state.intent === 'signup' ? 'signup' : 'login'}`);
  const code = req.query.code;
  if (typeof code !== 'string' || !code) return fail();

  try {
    const identity = await googleIdentityFromCode(code);
    const result = await resolveGoogleAccount(identity);
    if (result.kind === 'suspended') return fail('suspended');
    if (result.kind === 'conflict') {
      logger.warn('Google sign-in: email already linked to a different Google account');
      return fail();
    }

    const { user } = result;
    await issueSession(req, res, user);
    if (result.kind === 'created') {
      await audit(req, 'auth.register', {
        actorId: user.id,
        workspaceId: user.workspaceId,
        meta: { via: 'google' },
      });
    } else {
      await audit(req, 'auth.google_login', {
        actorId: user.id,
        workspaceId: user.workspaceId,
        meta: result.linked ? { via: 'google', linked: true } : { via: 'google' },
      });
    }
    res.redirect(`${env.appUrl}${state.next ?? homePathForRole(user.role)}`);
  } catch (err) {
    logger.warn({ err }, 'Google sign-in failed');
    fail();
  }
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { email, captchaToken } = forgotPasswordSchema.parse(req.body);
  await assertCaptcha(req, 'forgotPassword', captchaToken);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.suspended) {
    const token = randomToken(32);
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const link = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your Purple Voice password',
      text: `Hi ${user.name},\n\nUse this link within the next hour to choose a new password:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
  }
  // Same response either way, so the endpoint can't be used to find accounts.
  res.json({ ok: true });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: sha256(input.token) },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw badRequest('This reset link has expired. Request a new one.');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(input.password) },
    }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
});

// A well-formed scrypt record matching no password. Verifying against it costs the
// same as a real check, which keeps unknown-email logins from returning faster.
const DUMMY_HASH =
  'scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA==$' +
  'WkY0kq0Q4m8j2y2m7oYcV6m0sQqk3s8fQb7m2n1x9p0Yk4l3r2t1u0v9w8x7y6z5a4b3c2d1e0f9g8h7i6j5k4==';
