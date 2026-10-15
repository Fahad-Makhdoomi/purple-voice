import { Router } from 'express';
import { contactRequestSchema, paginationSchema } from '@pv/shared';
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
  const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
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
  const tag = z.string().max(40).optional().parse(req.query.tag || undefined);
  const where = { ...published(), ...(tag ? { tags: { has: tag } } : {}) };
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
    where: { ...published(), slug: { not: post.slug }, tags: { hasSome: post.tags } },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
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
  const page = await prisma.page.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
  if (!page) throw notFound('Page');
  res.json({ page });
});

publicRouter.get('/settings', async (_req, res) => {
  const [seo, analytics, security] = await Promise.all([
    getSetting('seo'),
    getSetting('analytics'),
    getSetting('security'),
  ]);
  res.json({
    seo,
    analytics,
    captcha: {
      provider: env.captchaEnabled ? env.CAPTCHA_PROVIDER : 'none',
      forms: env.captchaEnabled ? security.captcha : { signup: false, login: false, forgotPassword: false, contact: false },
    },
  });
});

/** Everything the sitemap needs in one request. */
publicRouter.get('/sitemap', async (_req, res) => {
  const [pages, posts] = await Promise.all([
    prisma.page.findMany({ where: { status: 'PUBLISHED', noindex: false }, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({ where: { ...published(), noindex: false }, select: { slug: true, updatedAt: true } }),
  ]);
  res.json({ pages, posts });
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
