import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden } from '../lib/http-error';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth. Session cookies are SameSite=Lax, so browsers don't
 * send them on cross-site POSTs; on top of that, any state-changing request
 * that carries an Origin header must come from our own site. Server-to-server
 * callers (Stripe, Twilio, Plivo, API-key clients) send no Origin and pass.
 */
export function checkOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.header('origin');
  if (!origin) return next();
  if (origin === env.appUrl || env.corsOrigins.includes(origin)) return next();
  throw forbidden('Cross-site request blocked');
}
