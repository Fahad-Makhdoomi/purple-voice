import type { Metadata, Viewport } from 'next';
import { Manrope, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/globals.css';
import { siteUrl } from '@/lib/config';
import { getSettings } from '@/lib/server-api';

// Self-hosted at build time by next/font: no request to Google, no layout shift.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
// The Kawaii theme's face. Not preloaded: browsers fetch it only on
// pages that use it, so other themes pay nothing for it.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: seo.siteName,
    openGraph: {
      siteName: seo.siteName,
      type: 'website',
      locale: 'en_US',
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}),
    },
    ...(seo.googleSiteVerification ? { verification: { google: seo.googleSiteVerification } } : {}),
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#07060c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jakarta.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
