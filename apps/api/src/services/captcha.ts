import type { Request } from 'express';
import type { CaptchaForm } from '@pv/shared';
import { env } from '../config/env';
import { badRequest } from '../lib/http-error';
import { logger } from '../lib/logger';
import { getSetting } from './settings';

const VERIFY_URL = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
} as const;

/**
 * Enforces the captcha on a public form when (a) a provider and secret are
 * configured in the environment and (b) the form's toggle is on in
 * Admin → Settings → Security. Either missing means the form is open, which
 * keeps local development friction-free.
 */
export async function assertCaptcha(req: Request, form: CaptchaForm, token: string | undefined) {
  if (!env.captchaEnabled || env.isTest) return;
  const settings = await getSetting('security');
  if (!settings.captcha[form]) return;
  if (!token) throw badRequest('Please complete the captcha');

  const provider = env.CAPTCHA_PROVIDER as keyof typeof VERIFY_URL;
  const body = new URLSearchParams({ secret: env.CAPTCHA_SECRET_KEY!, response: token });
  if (req.ip) body.set('remoteip', req.ip);

  let result: { success?: boolean; score?: number } = {};
  try {
    const res = await fetch(VERIFY_URL[provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    result = (await res.json()) as typeof result;
  } catch (err) {
    logger.error({ err, provider }, 'Captcha verification request failed');
    throw badRequest('Could not verify the captcha, please try again');
  }

  const scoreOk = typeof result.score !== 'number' || result.score >= env.CAPTCHA_MIN_SCORE;
  if (!result.success || !scoreOk) throw badRequest('Captcha check failed, please try again');
}
