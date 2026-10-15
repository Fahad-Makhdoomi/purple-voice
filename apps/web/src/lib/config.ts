/** Public, build-time configuration. Server-only values live in server-api.ts. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
export const captchaSiteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? '';

export const brand = {
  name: 'Purple Voice',
  tagline: 'AI voice agents for sales calls',
  supportEmail: 'hello@purplevoice.ai',
};
