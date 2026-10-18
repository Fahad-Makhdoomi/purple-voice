import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Analytics } from '@/components/site/Analytics';
import { CookieConsent } from '@/components/site/CookieConsent';
import { AnnouncementBar } from '@/components/site/AnnouncementBar';
import { ThemeMusic } from '@/components/site/ThemeMusic';
import { getHeaderPages, getSettings } from '@/lib/server-api';
import { themeMusic } from '@/lib/theme';

/**
 * Public website shell. Statically generated; content refreshes via on-demand
 * revalidation. `data-theme` applies the theme chosen in Super admin →
 * Website theme (see src/styles/themes).
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, headerPages] = await Promise.all([getSettings(), getHeaderPages()]);
  const { theme } = settings.appearance;
  const music = themeMusic(settings.appearance);
  const { announcement } = settings.content;
  const announce = announcement.enabled && !!announcement.text;
  return (
    <div data-theme={theme} className="site-theme" data-announcement={announce ? '' : undefined}>
      {announce && <AnnouncementBar value={announcement} />}
      <noscript>
        <style>
          {'.reveal{opacity:1!important;transform:none!important;filter:none!important}'}
        </style>
      </noscript>
      <Header pages={headerPages} />
      <main id="main">{children}</main>
      <Footer />
      {music && <ThemeMusic src={music} />}
      <Analytics settings={settings.analytics} />
      <CookieConsent />
    </div>
  );
}
