import { Router } from 'express';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { badRequest } from '../../lib/http-error';
import { liveReport, reportQuerySchema, trafficReport } from '../../services/web-analytics';
import {
  clearSearchConsole,
  inspectUrl,
  saveSearchConsole,
  searchConsoleInputSchema,
  searchConsoleView,
  searchPerformance,
  seoQuerySchema,
  sitemaps,
} from '../../services/search-console';
import { lastSiteAudit, pageSpeed, runSiteAudit } from '../../services/seo-audit';

/**
 * /api/admin/analytics/* — staff only (mounted behind requireStaff).
 * Website traffic from our own cookie-free tracker, Google Search Console
 * performance, and on-site SEO health.
 */
export const analyticsRouter = Router();

analyticsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// ── Traffic ─────────────────────────────────────────────────────────────────

analyticsRouter.get('/traffic', async (req, res) => {
  res.json(await trafficReport(reportQuerySchema.parse(req.query)));
});

analyticsRouter.get('/live', async (_req, res) => {
  res.json(await liveReport());
});

// ── Google Search Console ──────────────────────────────────────────────────

analyticsRouter.get('/search-console', async (_req, res) => {
  res.json(await searchConsoleView());
});

analyticsRouter.put('/search-console', requireSuperAdmin, async (req, res) => {
  await saveSearchConsole(searchConsoleInputSchema.parse(req.body));
  await audit(req, 'settings.updated', { entity: 'SiteSetting', entityId: 'searchConsole' });
  res.json(await searchConsoleView());
});

analyticsRouter.delete('/search-console', requireSuperAdmin, async (req, res) => {
  await clearSearchConsole();
  await audit(req, 'settings.updated', { entity: 'SiteSetting', entityId: 'searchConsole' });
  res.json(await searchConsoleView());
});

analyticsRouter.get('/seo/performance', async (req, res) => {
  res.json(await searchPerformance(seoQuerySchema.parse(req.query)));
});

analyticsRouter.get('/seo/sitemaps', async (_req, res) => {
  res.json({ sitemaps: await sitemaps() });
});

analyticsRouter.post('/seo/inspect', async (req, res) => {
  const { url } = z.object({ url: z.string().min(1).max(500) }).parse(req.body);
  res.json(await inspectUrl(url));
});

// ── On-site SEO health ─────────────────────────────────────────────────────

analyticsRouter.get('/seo/audit', (_req, res) => {
  res.json({ audit: lastSiteAudit() });
});

analyticsRouter.post('/seo/audit', async (_req, res) => {
  res.json({ audit: await runSiteAudit() });
});

analyticsRouter.post('/seo/pagespeed', async (req, res) => {
  const input = z
    .object({
      path: z.string().regex(/^\/(?![/\\])\S*$/).max(300),
      strategy: z.enum(['mobile', 'desktop']).default('mobile'),
    })
    .parse(req.body);
  try {
    res.json(await pageSpeed(input.path, input.strategy));
  } catch (err) {
    throw badRequest(`PageSpeed Insights: ${(err as Error).message}`);
  }
});
