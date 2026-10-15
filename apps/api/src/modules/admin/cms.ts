import { Router } from 'express';
import multer from 'multer';
import {
  faqSchema,
  mediaUpdateSchema,
  pageSchema,
  paginationSchema,
  postSchema,
  seoSuggestSchema,
  updateFaqSchema,
  updatePageSchema,
  updatePostSchema,
} from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { HttpError, badRequest, notFound } from '../../lib/http-error';
import { revalidate } from '../../services/revalidate';
import { getSetting, isSettingKey, setSetting } from '../../services/settings';
import { deleteImage, normaliseFolder, uploadImage } from '../../services/media';
import { Anthropic, claudeExtras } from '../../services/ai/claude';

/** Website content: pages, blog, FAQs, SEO/analytics settings and the media library. */
export const cmsRouter = Router();

const clean = <T extends Record<string, unknown>>(data: T) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])) as T;

// ── Pages ───────────────────────────────────────────────────────────────────

cmsRouter.get('/pages', async (_req, res) => {
  const pages = await prisma.page.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ pages });
});

cmsRouter.get('/pages/:id', async (req, res) => {
  const page = await prisma.page.findUnique({ where: { id: req.params.id } });
  if (!page) throw notFound('Page');
  res.json({ page });
});

cmsRouter.post('/pages', async (req, res) => {
  const input = clean(pageSchema.parse(req.body));
  const page = await prisma.page.create({
    data: { ...input, publishedAt: input.status === 'PUBLISHED' ? new Date() : null },
  });
  await audit(req, 'cms.page_created', { entity: 'Page', entityId: page.id });
  revalidate(['pages', `page:${page.slug}`]);
  res.status(201).json({ page });
});

cmsRouter.patch('/pages/:id', async (req, res) => {
  const input = clean(updatePageSchema.parse(req.body));
  const before = await prisma.page.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound('Page');
  const page = await prisma.page.update({
    where: { id: before.id },
    data: {
      ...input,
      publishedAt: input.status === 'PUBLISHED' && !before.publishedAt ? new Date() : undefined,
    },
  });
  await audit(req, 'cms.page_updated', { entity: 'Page', entityId: page.id });
  revalidate(['pages', `page:${before.slug}`, `page:${page.slug}`]);
  res.json({ page });
});

cmsRouter.delete('/pages/:id', async (req, res) => {
  const page = await prisma.page.delete({ where: { id: req.params.id } });
  await audit(req, 'cms.page_deleted', { entity: 'Page', entityId: page.id });
  revalidate(['pages', `page:${page.slug}`]);
  res.json({ ok: true });
});

// ── Blog ────────────────────────────────────────────────────────────────────

cmsRouter.get('/posts', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const where: Prisma.PostWhereInput = q ? { title: { contains: q, mode: 'insensitive' } } : {};
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, slug: true, title: true, status: true, publishedAt: true, updatedAt: true, tags: true },
    }),
    prisma.post.count({ where }),
  ]);
  res.json({ posts, total, page, pageSize });
});

cmsRouter.get('/posts/:id', async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) throw notFound('Post');
  res.json({ post });
});

cmsRouter.post('/posts', async (req, res) => {
  const input = clean(postSchema.parse(req.body));
  const post = await prisma.post.create({
    data: {
      ...input,
      authorId: req.user!.id,
      publishedAt: input.status === 'PUBLISHED' ? (input.publishedAt ?? new Date()) : input.publishedAt,
    },
  });
  await audit(req, 'cms.post_created', { entity: 'Post', entityId: post.id });
  revalidate(['posts', `post:${post.slug}`]);
  res.status(201).json({ post });
});

cmsRouter.patch('/posts/:id', async (req, res) => {
  const input = clean(updatePostSchema.parse(req.body));
  const before = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound('Post');
  const post = await prisma.post.update({
    where: { id: before.id },
    data: {
      ...input,
      publishedAt:
        input.status === 'PUBLISHED' && !before.publishedAt && !input.publishedAt ? new Date() : input.publishedAt,
    },
  });
  await audit(req, 'cms.post_updated', { entity: 'Post', entityId: post.id });
  revalidate(['posts', `post:${before.slug}`, `post:${post.slug}`]);
  res.json({ post });
});

cmsRouter.delete('/posts/:id', async (req, res) => {
  const post = await prisma.post.delete({ where: { id: req.params.id } });
  await audit(req, 'cms.post_deleted', { entity: 'Post', entityId: post.id });
  revalidate(['posts', `post:${post.slug}`]);
  res.json({ ok: true });
});

// ── FAQs ────────────────────────────────────────────────────────────────────

cmsRouter.get('/faqs', async (_req, res) => {
  const faqs = await prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  res.json({ faqs });
});

cmsRouter.post('/faqs', async (req, res) => {
  const faq = await prisma.faq.create({ data: faqSchema.parse(req.body) });
  revalidate(['faqs']);
  res.status(201).json({ faq });
});

cmsRouter.patch('/faqs/:id', async (req, res) => {
  const faq = await prisma.faq.update({ where: { id: req.params.id }, data: updateFaqSchema.parse(req.body) });
  revalidate(['faqs']);
  res.json({ faq });
});

cmsRouter.delete('/faqs/:id', async (req, res) => {
  await prisma.faq.delete({ where: { id: req.params.id } });
  revalidate(['faqs']);
  res.json({ ok: true });
});

// ── Site settings (SEO, analytics) ──────────────────────────────────────────

cmsRouter.get('/settings/:key', async (req, res) => {
  const key = req.params.key;
  if (!isSettingKey(key) || key === 'security') throw notFound('Setting');
  res.json({ value: await getSetting(key) });
});

cmsRouter.put('/settings/:key', async (req, res) => {
  const key = req.params.key;
  // Security settings (captcha) are super-admin only; see super.ts.
  if (!isSettingKey(key) || key === 'security') throw notFound('Setting');
  const value = await setSetting(key, req.body);
  await audit(req, 'settings.updated', { entity: 'SiteSetting', entityId: key });
  revalidate(['settings']);
  res.json({ value });
});

/** Drafts SEO metadata for a page or post with Claude (platform key). */
cmsRouter.post('/ai/seo-suggest', async (req, res) => {
  const input = seoSuggestSchema.parse(req.body);
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI is not configured', 'assistant_unavailable');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['seoTitle', 'seoDescription', 'excerpt'],
    properties: {
      seoTitle: { type: 'string', description: 'Search result title, at most 60 characters, no brand suffix.' },
      seoDescription: { type: 'string', description: 'Meta description, 140–160 characters, with a clear benefit.' },
      excerpt: { type: 'string', description: 'One or two sentence teaser for listing pages.' },
    },
  };
  const response = await client.beta.messages.create({
    model: env.ASSISTANT_MODEL,
    max_tokens: 16000,
    system:
      'You write search metadata for Purple Voice, an AI voice-agent platform for sales teams. Write plainly, specifically and without hype. Respect the length limits exactly.',
    messages: [{ role: 'user', content: `Title: ${input.title}\n\nContent:\n${input.body.slice(0, 60000)}` }],
    ...claudeExtras(env.ASSISTANT_MODEL, 'low', { type: 'json_schema', schema }),
  });
  if (response.stop_reason === 'refusal') throw badRequest('The AI could not write metadata for this content');
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '{}';
  const parsed = z
    .object({ seoTitle: z.string(), seoDescription: z.string(), excerpt: z.string() })
    .parse(JSON.parse(text));
  res.json({
    seoTitle: parsed.seoTitle.slice(0, 70),
    seoDescription: parsed.seoDescription.slice(0, 170),
    excerpt: parsed.excerpt.slice(0, 400),
  });
});

// ── Media library ───────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

cmsRouter.get('/media', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const folder = z.string().max(120).optional().parse(req.query.folder || undefined);
  const where: Prisma.MediaAssetWhereInput = {
    ...(folder ? { folder } : {}),
    ...(q
      ? { OR: [{ filename: { contains: q, mode: 'insensitive' } }, { alt: { contains: q, mode: 'insensitive' } }] }
      : {}),
  };
  const [assets, total, folders] = await Promise.all([
    prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.groupBy({ by: ['folder'], _count: { _all: true }, orderBy: { folder: 'asc' } }),
  ]);
  res.json({
    assets,
    total,
    page,
    pageSize,
    folders: folders.map((f) => ({ folder: f.folder, count: f._count._all })),
  });
});

cmsRouter.post('/media', upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('Choose one or more images');
  const folder = normaliseFolder(typeof req.body.folder === 'string' ? req.body.folder : undefined);
  const alt = typeof req.body.alt === 'string' ? req.body.alt.slice(0, 300) : '';

  const results = [];
  for (const file of files) {
    const { asset, duplicate } = await uploadImage({
      buffer: file.buffer,
      originalName: file.originalname,
      folder,
      alt,
      uploadedById: req.user!.id,
    });
    results.push({ asset, duplicate });
  }
  await audit(req, 'media.uploaded', { meta: { count: results.length, folder } });
  res.status(201).json({ results });
});

cmsRouter.patch('/media/:id', async (req, res) => {
  const input = mediaUpdateSchema.parse(req.body);
  const asset = await prisma.mediaAsset.update({ where: { id: req.params.id }, data: input });
  res.json({ asset });
});

cmsRouter.delete('/media/:id', async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) throw notFound('Image');
  const usedIn = await prisma.post.count({
    where: { OR: [{ coverImageUrl: asset.url }, { ogImageUrl: asset.url }, { body: { contains: asset.url } }] },
  }) + await prisma.page.count({ where: { OR: [{ ogImageUrl: asset.url }, { body: { contains: asset.url } }] } });
  if (usedIn) throw badRequest(`This image is used on ${usedIn} page(s) or post(s). Remove it there first.`);
  await deleteImage(asset.id);
  await audit(req, 'media.deleted', { entity: 'MediaAsset', entityId: asset.id });
  res.json({ ok: true });
});
