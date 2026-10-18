import { Router } from 'express';
import {
  PRIVACY_REGION_LABELS,
  PRIVACY_REQUEST_LABELS,
  RESOURCE_CATEGORIES,
  consentSchema,
  contactRequestSchema,
  paginationSchema,
  privacyRequestSchema,
} from '@pv/shared';
import { hmacSha256Hex } from '../lib/crypto';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http-error';
import { sendMail } from '../lib/mailer';
import { formLimiter } from '../middleware/rate-limit';
import { assertCaptcha } from '../services/captcha';
import { getSetting } from '../services/settings';

/**
 * Read-only content for the public website, plus the contact form. The web
 * app fetches these server-side and caches them (ISR); the API's
 * revalidation hook refreshes them when staff edit content.
 */
export const publicRouter = Router();

publicRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  next();
});

publicRouter.get('/plans', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      tagline: p.tagline,
      priceMonthlyCents: p.priceMonthlyCents,
      includedMinutes: p.includedMinutes,
      highlights: p.highlights,
      featured: p.featured,
      selfServe: p.selfServe,
      limits: p.limits,
      features: p.features,
    })),
  });
});

publicRouter.get('/faqs', async (_req, res) => {
  const faqs = await prisma.faq.findMany({
    where: { published: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, question: true, answer: true, category: true },
  });
  res.json({ faqs });
});

const published = () => ({ status: 'PUBLISHED' as const, publishedAt: { lte: new Date() } });

publicRouter.get('/posts', async (req, res) => {
  const { page, pageSize } = paginationSchema.parse(req.query);
  const tag = z
    .string()
    .max(40)
    .optional()
    .parse(req.query.tag || undefined);
  const section = z
    .enum(['blog', 'resources'])
    .optional()
    .parse(req.query.section || undefined);
  const sectionWhere =
    section === 'resources'
      ? { category: { in: [...RESOURCE_CATEGORIES] } }
      : section === 'blog'
        ? { OR: [{ category: null }, { category: { notIn: [...RESOURCE_CATEGORIES] } }] }
        : {};
  const where = { ...published(), ...sectionWhere, ...(tag ? { tags: { has: tag } } : {}) };
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        tags: true,
        category: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);
  res.json({ posts, total, page, pageSize });
});

publicRouter.get('/posts/:slug', async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { slug: req.params.slug, ...published() },
    include: { author: { select: { name: true } } },
  });
  if (!post) throw notFound('Post');
  const related = await prisma.post.findMany({
    where: {
      ...published(),
      slug: { not: post.slug },
      ...(post.category ? { category: post.category } : {}),
      tags: { hasSome: post.tags },
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      category: true,
      publishedAt: true,
    },
  });
  res.json({ post, related });
});

publicRouter.get('/pages', async (_req, res) => {
  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { title: 'asc' },
    select: { slug: true, title: true, showInFooter: true, updatedAt: true, noindex: true },
  });
  res.json({ pages });
});

publicRouter.get('/pages/:slug', async (req, res) => {
  const page = await prisma.page.findFirst({
    where: { slug: req.params.slug, status: 'PUBLISHED' },
  });
  if (!page) throw notFound('Page');
  res.json({ page });
});

publicRouter.get('/settings', async (_req, res) => {
  const [seo, analytics, security, appearance, content, legal] = await Promise.all([
    getSetting('seo'),
    getSetting('analytics'),
    getSetting('security'),
    getSetting('appearance'),
    getSetting('content'),
    getSetting('legal'),
  ]);
  res.json({
    seo,
    analytics,
    appearance,
    content,
    legal,
    captcha: {
      provider: env.captchaEnabled ? env.CAPTCHA_PROVIDER : 'none',
      forms: env.captchaEnabled
        ? security.captcha
        : { signup: false, login: false, forgotPassword: false, contact: false },
    },
  });
});

/** Everything the sitemap needs in one request. */
publicRouter.get('/sitemap', async (_req, res) => {
  const [pages, posts] = await Promise.all([
    prisma.page.findMany({
      where: { status: 'PUBLISHED', noindex: false },
      select: { slug: true, updatedAt: true },
    }),
    prisma.post.findMany({
      where: { ...published(), noindex: false },
      select: { slug: true, category: true, updatedAt: true },
    }),
  ]);
  res.json({ pages, posts });
});

/**
 * Records a visitor's cookie choices, so consent can be shown to have been
 * given (GDPR art. 7(1), UK GDPR, PECR). No account and no raw IP: a random
 * id from the browser and a keyed hash of the address.
 */
publicRouter.post('/consent', formLimiter, async (req, res) => {
  const input = consentSchema.parse(req.body);
  await prisma.consentRecord.create({
    data: {
      ...input,
      ipHash: req.ip ? hmacSha256Hex(env.URL_SIGNING_SECRET, req.ip).slice(0, 32) : null,
      userAgent: req.header('user-agent')?.slice(0, 300) ?? null,
    },
  });
  res.status(201).json({ ok: true });
});

/**
 * A privacy rights request (access, deletion, correction, opt-out of sale or
 * sharing…) from the public site. Lands in Admin → Leads as source
 * "privacy_request"; GDPR gives a month to answer, CCPA 45 days.
 */
publicRouter.post('/privacy-request', formLimiter, async (req, res) => {
  const input = privacyRequestSchema.parse(req.body);
  if (input.website) return res.status(201).json({ ok: true });
  await assertCaptcha(req, 'contact', input.captchaToken);
  const due = new Date(Date.now() + (input.region.startsWith('US') ? 45 : 30) * 864e5);
  const message = [
    `Privacy request: ${PRIVACY_REQUEST_LABELS[input.type]}`,
    `Where they live: ${PRIVACY_REGION_LABELS[input.region]}`,
    input.onBehalf ? 'Made by an authorised agent on someone else’s behalf.' : null,
    `Reply by: ${due.toISOString().slice(0, 10)}. Verify the requester owns ${input.email} first.`,
    input.details ? `\n${input.details}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const lead = await prisma.lead.create({
    data: { name: input.name, email: input.email, message, source: 'privacy_request' },
  });
  if (env.SUPPORT_NOTIFY_EMAILS) {
    void sendMail({
      to: env.SUPPORT_NOTIFY_EMAILS.split(',').map((s) => s.trim()),
      subject: `Privacy request (${PRIVACY_REQUEST_LABELS[input.type]}) from ${lead.name}`,
      text: `${lead.name} <${lead.email}>\n\n${message}\n\n${env.appUrl}/admin/leads`,
    });
  }
  void sendMail({
    to: input.email,
    subject: 'We received your privacy request',
    text: `Hi ${input.name},\n\nWe received your request: ${PRIVACY_REQUEST_LABELS[input.type]}. We may email you to confirm it is you, and we will reply by ${due.toISOString().slice(0, 10)} at the latest.\n\nIf you did not send this, you can ignore this email.`,
  });
  res.status(201).json({ ok: true });
});

publicRouter.post('/contact', formLimiter, async (req, res) => {
  const input = contactRequestSchema.parse(req.body);
  // Honeypot filled: answer like a success so the bot learns nothing.
  if (input.website) return res.status(201).json({ ok: true });
  await assertCaptcha(req, 'contact', input.captchaToken);
  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      message: input.message,
      plan: input.plan,
      source: input.plan === 'ENTERPRISE' ? 'enterprise' : 'contact_form',
    },
  });
  if (env.SUPPORT_NOTIFY_EMAILS) {
    void sendMail({
      to: env.SUPPORT_NOTIFY_EMAILS.split(',').map((s) => s.trim()),
      subject: `New ${lead.source === 'enterprise' ? 'Enterprise' : 'website'} enquiry from ${lead.name}`,
      text: `${lead.name} <${lead.email}>${lead.company ? ` — ${lead.company}` : ''}\n\n${lead.message}\n\n${env.appUrl}/admin/leads`,
    });
  }
  res.status(201).json({ ok: true });
});
