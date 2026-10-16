/**
 * The browser only ever talks to this origin. /api/*, /uploads/* and /ws/*
 * are forwarded to the Express API (in production nginx does this before the
 * request reaches Next, so these rewrites matter for development).
 */
const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
const captchaHosts =
  'https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com';
const analyticsHosts =
  'https://plausible.io https://www.googletagmanager.com https://www.google-analytics.com';
/**
 * The browser dialer's audio socket (/ws/dialer/…) is same-origin. CSP3
 * browsers let 'self' cover ws:/wss: on this host; older Safari needs it named.
 */
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
const siteSocket = `${site.protocol === 'https:' ? 'wss:' : 'ws:'}//${site.host}`;

/**
 * Content-Security-Policy. Scripts are limited to this origin plus the
 * captcha and analytics vendors the admin can enable. 'unsafe-inline' for
 * scripts is required by statically generated Next.js pages (nonces would
 * force every page to render per request and cost the PageSpeed budget);
 * XSS is prevented at the source instead — React escapes all output and
 * Markdown is rendered without raw HTML. See ARCHITECTURE.md § Security.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${captchaHosts} ${analyticsHosts}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${siteSocket} ${captchaHosts} ${analyticsHosts}`,
  `frame-src ${captchaHosts}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Render <title>/<meta> in <head> for every client instead of streaming it
  // into the body on dynamic pages (/contact reads ?plan). Our metadata is
  // static or cached, so nothing waits on it, and SEO tools that don't run
  // JavaScript still see the description.
  htmlLimitedBots: /.*/,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
      // Next proxies WebSocket upgrades on external rewrites: the dialer's call audio.
      { source: '/ws/:path*', destination: `${API}/ws/:path*` },
    ];
  },
  async headers() {
    const security = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // The dashboard's dialer uses the microphone; no third-party frame may.
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(self), geolocation=(), payment=()',
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];
    return [
      { source: '/:path*', headers: security },
      // Dashboards and admin are private: never cached by shared caches, never indexed.
      {
        source: '/(dashboard|admin)/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
