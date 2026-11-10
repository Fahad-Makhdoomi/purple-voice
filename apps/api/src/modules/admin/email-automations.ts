import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { requireSuperAdmin } from '../../middleware/auth';
import {
  isStepKey,
  lifecycleSettings,
  lifecycleSettingsSchema,
  lifecycleStats,
  renderStep,
  saveLifecycleSettings,
  sendTestStep,
} from '../../services/lifecycle-emails';

/**
 * /api/admin/email-automations — the welcome, onboarding and upgrade-to-Pro
 * sequence (services/lifecycle-emails.ts) and the sign-up domain blocklist.
 * Staff can look; super admins change settings.
 */
export const emailAutomationsRouter = Router();

emailAutomationsRouter.get('/', async (_req, res) => {
  const [settings, stats] = await Promise.all([lifecycleSettings(), lifecycleStats()]);
  res.json({ settings, ...stats });
});

emailAutomationsRouter.put('/', requireSuperAdmin, async (req, res) => {
  const input = lifecycleSettingsSchema.parse(req.body);
  const settings = await saveLifecycleSettings(input);
  await audit(req, 'settings.updated', { entity: 'SiteSetting', entityId: 'lifecycleEmails' });
  res.json({ settings });
});

/** The email as the signed-in staff member would receive it (HTML, for an iframe). */
emailAutomationsRouter.get('/preview/:step', async (req, res) => {
  if (!isStepKey(req.params.step)) throw notFound('Email');
  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const r = await renderStep(req.params.step, me);
  res.json({ subject: r.subject, html: r.html, text: r.text });
});

emailAutomationsRouter.post('/test/:step', async (req, res) => {
  if (!isStepKey(req.params.step)) throw notFound('Email');
  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const { sent } = await sendTestStep(req.params.step, me).catch((err: Error) => {
    throw badRequest(`The mail server refused the email: ${err.message}`);
  });
  if (!sent) throw badRequest('No mail server is set up yet (Admin → Email).');
  res.json({ ok: true, to: me.email });
});
