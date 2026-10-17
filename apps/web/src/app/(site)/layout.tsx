import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Analytics } from '@/components/site/Analytics';
import { ThemeMusic } from '@/components/site/ThemeMusic';
import { getSettings } from '@/lib/server-api';
import { themeMusic } from '@/lib/theme';

/**
 * Public website shell. Statically generated; content refreshes via on-demand
 * revalidation. `data-theme` applies the theme chosen in Super admin →
 * Website theme (see src/styles/themes).
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const { theme } = settings.appearance;
  const music = themeMusic(settings.appearance);
  return (
    <div data-theme={theme} className="site-theme">
      <noscript>
        <style>{'.reveal{opacity:1!important;transform:none!important;filter:none!important}'}</style>
      </noscript>
      <Header theme={theme} />
      <main id="main">{children}</main>
      <Footer />
      {music && <ThemeMusic src={music} />}
      <Analytics settings={settings.analytics} />
    </div>
  );
}
