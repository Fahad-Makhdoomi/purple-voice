import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Analytics } from '@/components/site/Analytics';
import { getSettings } from '@/lib/server-api';

/** Public website shell. Statically generated; content refreshes via on-demand revalidation. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <Analytics settings={settings.analytics} />
    </>
  );
}
