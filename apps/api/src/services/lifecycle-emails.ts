import { z } from 'zod';
import type { Prisma, User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { hmacSha256Hex, safeEqual } from '../lib/crypto';
import { sendMail, sendMailStrict } from '../lib/mailer';
import { getEntitlements } from './entitlements';
import { renderEmail, type EmailContent } from './email-templates';

/**
 * Account and lifecycle email: the "confirm your email" message, the welcome
 * once confirmed, then a short onboarding and upgrade-to-Pro sequence.
 *
 * The sequence starts from the welcome, so only people who confirmed their
 * address get it; accounts from before it existed never got a welcome and
 * are left alone. Each step is claimed with a LifecycleEmail row before it
 * is sent, so a step goes out at most once per person. Upgrade steps are
 * skipped for workspaces already on Pro or Enterprise. Everything but the
 * verification email carries an unsubscribe link (and List-Unsubscribe
 * headers); super admins switch steps on and off in Admin → Email automations.
 */

const KEY = 'lifecycleEmails';
const DAY = 24 * 60 * 60 * 1000;
/** A step more than this late (the worker was down, or the step was off) is not sent. */
const LATE_DAYS = 3;
const BATCH = 100;

export type StepKey =
  | 'welcome'
  | 'getting-started'
  | 'pro-features'
  | 'pro-offer'
  | 'trial-ending'
  | 'last-call';

interface StepDef {
  key: StepKey;
  name: string;
  /** Days after the email was confirmed; 0 = sent at confirmation. */
  delayDays: number;
  /** Upgrade emails skip workspaces already on Pro or above. */
  upgrade: boolean;
}

export const STEPS: StepDef[] = [
  { key: 'welcome', name: 'Welcome', delayDays: 0, upgrade: false },
  { key: 'getting-started', name: 'Get your first agent live', delayDays: 1, upgrade: false },
  { key: 'pro-features', name: 'What Pro unlocks', delayDays: 3, upgrade: true },
  { key: 'pro-offer', name: 'Upgrade offer', delayDays: 7, upgrade: true },
  { key: 'trial-ending', name: 'Free month ends soon', delayDays: 21, upgrade: true },
  { key: 'last-call', name: 'Last call before the free month ends', delayDays: 28, upgrade: true },
];

export const lifecycleSettingsSchema = z.object({
  enabled: z.boolean(),
  /** A Stripe promotion code to show in upgrade emails (customers type it at checkout). */
  offerCode: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, 'Letters, numbers, - and _ only'),
  /** What the code gives, e.g. "20% off your first 3 months of Pro". */
  offerText: z.string().trim().max(140),
  steps: z.record(z.string(), z.object({ enabled: z.boolean() })),
  /** Extra domains to refuse at sign-up, on top of the disposable-email list. */
  blockedDomains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Enter domains like example.com'),
    )
    .max(500),
});
export type LifecycleSettings = z.infer<typeof lifecycleSettingsSchema>;

const DEFAULTS: LifecycleSettings = {
  enabled: true,
  offerCode: '',
  offerText: '',
  steps: {},
  blockedDomains: [],
};

let cache: { at: number; value: LifecycleSettings } | null = null;

export async function lifecycleSettings(): Promise<LifecycleSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const parsed = lifecycleSettingsSchema.partial().safeParse(row?.value ?? {});
  const value = { ...DEFAULTS, ...(parsed.success ? parsed.data : {}) };
  cache = { at: Date.now(), value };
  return value;
}

export async function saveLifecycleSettings(input: LifecycleSettings) {
  const value = { ...input, blockedDomains: [...new Set(input.blockedDomains)] };
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
  cache = null;
  return value;
}

function stepEnabled(s: LifecycleSettings, key: StepKey) {
  return s.enabled && (s.steps[key]?.enabled ?? true);
}

// ── Unsubscribe ─────────────────────────────────────────────────────────────

export function unsubscribeSig(userId: string): string {
  return hmacSha256Hex(env.URL_SIGNING_SECRET, `unsubscribe:${userId}`).slice(0, 32);
}

export function verifyUnsubscribe(userId: unknown, sig: unknown): userId is string {
  return (
    typeof userId === 'string' &&
    typeof sig === 'string' &&
    sig.length === 32 &&
    safeEqual(unsubscribeSig(userId), sig)
  );
}

export function unsubscribeUrl(userId: string): string {
  const u = new URL(`${env.publicApiUrl}/api/public/unsubscribe`);
  u.searchParams.set('u', userId);
  u.searchParams.set('s', unsubscribeSig(userId));
  return u.toString();
}

// ── Content ─────────────────────────────────────────────────────────────────

interface ProInfo {
  name: string;
  price: string | null;
  highlights: string[];
}

async function proPlan(): Promise<ProInfo> {
  const plan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
  return {
    name: plan?.name ?? 'Pro',
    price:
      plan?.priceMonthlyCents != null
        ? `$${(plan.priceMonthlyCents / 100).toFixed(plan.priceMonthlyCents % 100 ? 2 : 0)}`
        : null,
    highlights: plan?.highlights?.length
      ? plan.highlights.slice(0, 6)
      : [
          'More AI agents and phone numbers',
          'Outbound calling campaigns',
          'More included call minutes',
          'Priority support',
        ],
  };
}

const first = (name: string) => name.trim().split(/\s+/)[0] || 'there';

function link(path: string, campaign: string) {
  const u = new URL(path, env.appUrl);
  u.searchParams.set('utm_source', 'lifecycle');
  u.searchParams.set('utm_medium', 'email');
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

export function verificationEmail(name: string, url: string): EmailContent {
  return {
    preheader: 'One click and your Purple Voice account is ready.',
    eyebrow: 'Confirm your email',
    heading: `Almost there, ${first(name)}`,
    paragraphs: [
      'Thanks for signing up for Purple Voice. Please confirm this is your email address so we can finish setting up your account.',
    ],
    cta: { label: 'Confirm my email', url },
    after: [
      'The link works for 24 hours. If you didn’t create an account, you can ignore this email and nothing will happen.',
    ],
  };
}

export function existingAccountEmail(name: string): EmailContent {
  return {
    preheader: 'Someone tried to create a new account with your email.',
    eyebrow: 'Account notice',
    heading: 'You already have an account',
    paragraphs: [
      `Hi ${first(name)}, someone (hopefully you) just tried to sign up for Purple Voice with this email address. You already have an account, so there’s nothing new to create.`,
      'Sign in below. If you’ve forgotten your password, use “Forgot password?” on the sign-in page.',
    ],
    cta: { label: 'Sign in', url: `${env.appUrl}/login` },
    after: ['If this wasn’t you, you can ignore this email. Your account is unchanged.'],
  };
}

async function stepContent(
  step: StepKey,
  user: Pick<User, 'id' | 'name'>,
  s: LifecycleSettings,
): Promise<{ subject: string; content: EmailContent }> {
  const name = first(user.name);
  const unsub = unsubscribeUrl(user.id);
  const offer =
    s.offerCode && (step === 'pro-offer' || step === 'trial-ending' || step === 'last-call')
      ? {
          title: 'Your offer',
          text: `${s.offerText || 'A discount on Pro'}. Use code ${s.offerCode} at checkout.`,
        }
      : undefined;
  const upgradeUrl = link('/dashboard/billing?plan=PRO', step);

  switch (step) {
    case 'welcome':
      return {
        subject: `Welcome to Purple Voice, ${name}`,
        content: {
          preheader: 'Your AI voice agent can be answering calls in minutes.',
          eyebrow: 'Welcome aboard',
          heading: `Welcome to Purple Voice, ${name}!`,
          paragraphs: [
            'Your account is confirmed and your first month is free. Purple Voice puts an AI voice agent on your phone line that answers calls, books appointments, qualifies leads and hands over to your team when it matters.',
            'Here’s how to get your first agent live:',
          ],
          bullets: [
            'Create an agent: give it a name, a voice and what your business does.',
            'Teach it: add your FAQs, prices and opening hours.',
            'Connect a phone number, or try it right in your browser.',
            'Watch calls come in with summaries, recordings and booked appointments.',
          ],
          cta: { label: 'Open my dashboard', url: link('/dashboard', 'welcome') },
          after: [
            'Stuck on anything? Reply to this email. A real person reads every message.',
          ],
          unsubscribeUrl: unsub,
        },
      };
    case 'getting-started':
      return {
        subject: 'Get your first AI agent on the phone today',
        content: {
          preheader: 'A five-minute setup that pays for itself on the first missed call.',
          eyebrow: 'Getting started',
          heading: 'Your first agent, in about five minutes',
          paragraphs: [
            `Hi ${name}, businesses miss around one in four calls, and most callers who reach voicemail never call back. Your Purple Voice agent picks up every one of them, day or night.`,
            'If you haven’t set yours up yet, this is all it takes:',
          ],
          bullets: [
            'Pick a voice that sounds like your brand.',
            'Paste in your website or FAQs so it knows your business.',
            'Tell it what to do: book appointments, take messages or transfer calls.',
            'Make a test call from your browser before going live.',
          ],
          cta: { label: 'Set up my agent', url: link('/dashboard/agents', step) },
          after: ['Want a hand? Reply and we’ll help you set it up.'],
          unsubscribeUrl: unsub,
        },
      };
    case 'pro-features': {
      const pro = await proPlan();
      return {
        subject: `What ${pro.name} unlocks for your business`,
        content: {
          preheader: 'More agents, campaigns and minutes for growing teams.',
          eyebrow: `Purple Voice ${pro.name}`,
          heading: 'Ready to handle more calls?',
          paragraphs: [
            `Hi ${name}, you’ve had Purple Voice for a few days now. When one agent isn’t enough, ${pro.name} gives your team room to grow${pro.price ? ` for ${pro.price} a month` : ''}:`,
          ],
          bullets: pro.highlights,
          cta: { label: `See ${pro.name}`, url: upgradeUrl },
          after: ['You can switch plans or cancel whenever you like from the Billing page.'],
          unsubscribeUrl: unsub,
        },
      };
    }
    case 'pro-offer': {
      const pro = await proPlan();
      return {
        subject: offer
          ? `Your ${pro.name} offer: ${s.offerText || 'a discount to get started'}`
          : `Do more with ${pro.name}`,
        content: {
          preheader: `Run outbound campaigns and more with ${pro.name}.`,
          eyebrow: 'An offer for you',
          heading: `Put ${pro.name} to work`,
          paragraphs: [
            `Hi ${name}, teams on ${pro.name} use Purple Voice for more than answering: they call back leads within seconds, run follow-up campaigns and confirm appointments automatically.`,
          ],
          bullets: pro.highlights.slice(0, 4),
          callout: offer,
          cta: { label: `Upgrade to ${pro.name}`, url: upgradeUrl },
          after: ['Questions about which plan fits? Just reply.'],
          unsubscribeUrl: unsub,
        },
      };
    }
    case 'trial-ending': {
      const pro = await proPlan();
      return {
        subject: 'Your free month ends in about a week',
        content: {
          preheader: 'Pick a plan so your agent keeps answering.',
          eyebrow: 'Free month',
          heading: 'Keep your agent answering',
          paragraphs: [
            `Hi ${name}, your free month of Purple Voice ends in about a week. Choose a plan before then so your agent keeps picking up without a break.`,
            `Most growing teams choose ${pro.name}${pro.price ? ` (${pro.price} a month)` : ''} for more agents, numbers and minutes.`,
          ],
          callout: offer,
          cta: { label: 'Choose my plan', url: upgradeUrl },
          unsubscribeUrl: unsub,
        },
      };
    }
    case 'last-call': {
      const pro = await proPlan();
      return {
        subject: 'Two days left on your free month',
        content: {
          preheader: 'Upgrade now and nothing changes for your callers.',
          eyebrow: 'Last call',
          heading: 'Two days left',
          paragraphs: [
            `Hi ${name}, your free month ends in two days. Upgrade to ${pro.name} now and your agents, numbers and call history carry on exactly as they are.`,
          ],
          callout: offer,
          cta: { label: `Upgrade to ${pro.name}`, url: upgradeUrl },
          after: ['Not ready yet? Reply and tell us what’s missing. We read everything.'],
          unsubscribeUrl: unsub,
        },
      };
    }
  }
}

function listUnsubscribeHeaders(userId: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl(userId)}>, <mailto:${env.MAIL_REPLY_TO}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** Renders one step for a user (also used for the admin preview and test send). */
export async function renderStep(step: StepKey, user: Pick<User, 'id' | 'name'>) {
  const s = await lifecycleSettings();
  const { subject, content } = await stepContent(step, user, s);
  return { subject, ...renderEmail(content) };
}

async function claim(userId: string, step: StepKey, skipped = false): Promise<boolean> {
  try {
    await prisma.lifecycleEmail.create({ data: { userId, step, skipped } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return false; // already sent
    throw err;
  }
}

async function deliver(step: StepKey, user: Pick<User, 'id' | 'name' | 'email'>) {
  const r = await renderStep(step, user);
  await sendMail({
    to: user.email,
    subject: r.subject,
    text: r.text,
    html: r.html,
    headers: listUnsubscribeHeaders(user.id),
  });
}

/** Sent when the user confirms their email (or signs up with Google). */
export async function sendWelcome(user: Pick<User, 'id' | 'name' | 'email' | 'role'>) {
  if (user.role !== 'SUBSCRIBER') return;
  const s = await lifecycleSettings();
  if (!stepEnabled(s, 'welcome')) {
    // Still start the sequence, so the later steps follow.
    await claim(user.id, 'welcome', true);
    return;
  }
  if (await claim(user.id, 'welcome')) await deliver('welcome', user);
}

/** Admin "send me a test". */
export async function sendTestStep(step: StepKey, to: Pick<User, 'id' | 'name' | 'email'>) {
  const r = await renderStep(step, to);
  return sendMailStrict({
    to: to.email,
    subject: `[Test] ${r.subject}`,
    text: r.text,
    html: r.html,
    headers: listUnsubscribeHeaders(to.id),
  });
}

/** Worker tick: sends whatever steps are due. */
export async function lifecycleTick(now = Date.now()): Promise<void> {
  const s = await lifecycleSettings();
  if (!s.enabled) return;
  for (const step of STEPS) {
    if (step.delayDays === 0 || !stepEnabled(s, step.key)) continue;
    const users = await prisma.user.findMany({
      where: {
        role: 'SUBSCRIBER',
        suspended: false,
        workspaceId: { not: null },
        emailUnsubscribedAt: null,
        emailVerifiedAt: {
          lte: new Date(now - step.delayDays * DAY),
          gte: new Date(now - (step.delayDays + LATE_DAYS) * DAY),
        },
        AND: [
          { lifecycleEmails: { some: { step: 'welcome' } } },
          { lifecycleEmails: { none: { step: step.key } } },
        ],
      },
      select: { id: true, name: true, email: true, workspaceId: true },
      take: BATCH,
    });
    for (const u of users) {
      try {
        if (step.upgrade) {
          const ent = await getEntitlements(u.workspaceId!);
          if (ent.active && (ent.planCode === 'PRO' || ent.planCode === 'ENTERPRISE')) {
            await claim(u.id, step.key, true);
            continue;
          }
        }
        if (await claim(u.id, step.key)) await deliver(step.key, u);
      } catch (err) {
        logger.error({ err, userId: u.id, step: step.key }, 'Lifecycle email failed');
      }
    }
  }
}

/** For the admin page: sent and skipped counts per step, all time and last 30 days. */
export async function lifecycleStats() {
  const since = new Date(Date.now() - 30 * DAY);
  const [all, recent, unsubscribed, pendingVerification] = await Promise.all([
    prisma.lifecycleEmail.groupBy({ by: ['step', 'skipped'], _count: { _all: true } }),
    prisma.lifecycleEmail.groupBy({
      by: ['step', 'skipped'],
      where: { sentAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { emailUnsubscribedAt: { not: null } } }),
    prisma.user.count({ where: { role: 'SUBSCRIBER', emailVerifiedAt: null } }),
  ]);
  const pick = (rows: typeof all, step: string, skipped: boolean) =>
    rows.find((r) => r.step === step && r.skipped === skipped)?._count._all ?? 0;
  return {
    steps: STEPS.map((st) => ({
      key: st.key,
      name: st.name,
      delayDays: st.delayDays,
      upgrade: st.upgrade,
      sent: pick(all, st.key, false),
      sent30d: pick(recent, st.key, false),
      skipped: pick(all, st.key, true),
    })),
    unsubscribed,
    pendingVerification,
  };
}

export function isStepKey(v: unknown): v is StepKey {
  return typeof v === 'string' && STEPS.some((s) => s.key === v);
}
