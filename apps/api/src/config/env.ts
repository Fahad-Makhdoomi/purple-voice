import { z } from 'zod';

/**
 * Every environment variable the API reads, parsed once at boot. A missing or
 * malformed required value stops the process here rather than surfacing as a
 * confusing failure on the first request that needs it.
 */

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  API_HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1),

  /** Public origin of the website, e.g. https://purplevoice.ai */
  APP_URL: z.string().url().default('http://localhost:3000'),
  /**
   * Public origin telephony providers call back to. In production nginx
   * serves /api and /media on the same host as the site, so this is usually
   * APP_URL. In local development point it at a tunnel (ngrok, cloudflared).
   */
  PUBLIC_API_URL: optionalString,
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  COOKIE_DOMAIN: optionalString,

  /** 32 random bytes, base64. Encrypts credentials at rest. */
  APP_ENCRYPTION_KEY: z.string().min(40),
  /** Signs the callback URLs handed to telephony providers. */
  URL_SIGNING_SECRET: z.string().min(32),

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_BASIC: optionalString,
  STRIPE_PRICE_PRO: optionalString,
  /**
   * Development only: activate a plan instantly at "checkout" when Stripe is
   * not configured. Ignored in production.
   */
  BILLING_DEV_BYPASS: bool,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  MAIL_FROM: z.string().default('Purple Voice <no-reply@purplevoice.ai>'),
  SUPPORT_NOTIFY_EMAILS: optionalString,

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  /** Graph API version for WhatsApp (Meta Cloud API) integrations. */
  WHATSAPP_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v23.0'),

  /** The platform's own Claude key: powers the in-dashboard AI support assistant. */
  ANTHROPIC_API_KEY: optionalString,
  ASSISTANT_MODEL: z.string().default('claude-opus-5-5'),

  /** Captcha for public forms: none | turnstile | recaptcha | hcaptcha. */
  CAPTCHA_PROVIDER: z.enum(['none', 'turnstile', 'recaptcha', 'hcaptcha']).default('none'),
  CAPTCHA_SECRET_KEY: optionalString,
  /** reCAPTCHA v3 only: minimum score to accept (0–1). */
  CAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),

  /** Where uploaded media lives: local disk (served by nginx) or S3-compatible storage (R2, S3, B2). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('../../storage/uploads'),
  /** Call recordings on local disk: private, never under the public uploads directory. */
  RECORDINGS_LOCAL_PATH: z.string().default('../../storage/recordings'),
  /** Public URL prefix for stored files, e.g. https://purplevoice.ai/uploads */
  STORAGE_PUBLIC_URL: optionalString,
  S3_BUCKET: optionalString,
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(10),
  /** WebP quality for photographic uploads (1–100). Graphics with transparency are encoded losslessly. */
  MEDIA_WEBP_QUALITY: z.coerce.number().int().min(1).max(100).default(90),

  /** The web app's server-side origin, used to trigger on-demand revalidation. */
  WEB_INTERNAL_URL: z.string().url().default('http://127.0.0.1:3000'),
  REVALIDATE_SECRET: optionalString,

  DIALER_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  publicApiUrl: (raw.PUBLIC_API_URL ?? raw.APP_URL).replace(/\/$/, ''),
  appUrl: raw.APP_URL.replace(/\/$/, ''),
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  stripeEnabled: !!raw.STRIPE_SECRET_KEY,
  billingBypass: raw.NODE_ENV !== 'production' && raw.BILLING_DEV_BYPASS && !raw.STRIPE_SECRET_KEY,
  googleEnabled: !!raw.GOOGLE_CLIENT_ID && !!raw.GOOGLE_CLIENT_SECRET,
  captchaEnabled: raw.CAPTCHA_PROVIDER !== 'none' && !!raw.CAPTCHA_SECRET_KEY,
  storagePublicUrl: (raw.STORAGE_PUBLIC_URL ?? `${raw.APP_URL.replace(/\/$/, '')}/uploads`).replace(
    /\/$/,
    '',
  ),
};

/** wss:// origin for media streams, derived from the public API URL. */
export function publicWsUrl(path: string): string {
  const u = new URL(env.publicApiUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = path;
  u.search = '';
  return u.toString();
}
