import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'rate_limited', message: 'Too many requests, slow down' } },
};

/** Sign-in, sign-up and password reset: slows credential stuffing. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 30 });

/** Public forms (contact sales). */
export const formLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 10 });

/** Developer API, per key or IP. */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.apiKeyId ?? req.ip ?? 'anon',
});

/** AI assistant: each message costs model tokens. */
export const assistantLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.workspaceId ?? req.ip ?? 'anon',
});
