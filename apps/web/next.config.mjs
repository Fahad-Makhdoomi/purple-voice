/**
 * The browser only ever talks to this origin. /api/*, /uploads/* and /ws/*
 * are forwarded to the Express API (in production nginx does this before the
 * request reaches Next, so these rewrites matter for development).
 */
const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
const captchaHosts =
  'https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com';
/** Razorpay Standard Checkout: the script, its payment iframe and its beacons. */
const razorpayScript = 'https://checkout.razorpay.com https://cdn.razorpay.com';
const razorpayFrames = 'https://api.razorpay.com https://checkout.razorpay.com';
const razorpayConnect = 'https://*.razorpay.com';
/** Page-builder video blocks: privacy-enhanced YouTube and Vimeo players. */
const videoFrames = 'https://www.youtube-nocookie.com https://player.vimeo.com';
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
 * 'unsafe-eval' is added in development only: `next dev` (React Refresh)
 * evaluates code at runtime; production builds never do.
 */
const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const cspWith = (frameAncestors) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devEval} ${captchaHosts} ${analyticsHosts} ${razorpayScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${siteSocket} ${captchaHosts} ${analyticsHosts} ${razorpayConnect}`,
    `frame-src 'self' ${captchaHosts} ${razorpayFrames} ${videoFrames}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.razorpay.com",
    `frame-ancestors ${frameAncestors}`,
    'upgrade-insecure-requests',
  ].join('; ');
const csp = cspWith("'none'");

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
        value:
          'camera=(), microphone=(self), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
      },
      // Razorpay opens bank / UPI approval pages in a popup that must keep its opener.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ];
    return [
      { source: '/:path*', headers: security },
      // The page builder previews pages in an iframe of this route; only this site may frame it.
      {
        source: '/builder-preview',
        headers: [
          { key: 'Content-Security-Policy', value: cspWith("'self'") },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
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
