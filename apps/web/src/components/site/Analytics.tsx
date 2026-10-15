import Script from 'next/script';
import type { PublicSettings } from '@/lib/server-api';

/**
 * Optional analytics, configured in Admin → SEO. Both load with
 * `lazyOnload` — after the page is interactive — so they never count
 * against Largest Contentful Paint or Total Blocking Time.
 */
export function Analytics({ settings }: { settings: PublicSettings['analytics'] }) {
  const ga = settings.ga4MeasurementId;
  return (
    <>
      {settings.plausibleDomain && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={settings.plausibleDomain}
          strategy="lazyOnload"
        />
      )}
      {ga && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`}
            strategy="lazyOnload"
          />
          <Script id="ga4" strategy="lazyOnload">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`}
          </Script>
        </>
      )}
    </>
  );
}
