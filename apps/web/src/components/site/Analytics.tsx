'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { PublicSettings } from '@/lib/server-api';
import { onConsentChange, readConsent } from '@/lib/consent';

/**
 * Optional analytics, configured in Admin → SEO. Both load with `lazyOnload`
 * — after the page is interactive — so they never count against Largest
 * Contentful Paint or Total Blocking Time.
 *
 * Plausible sets no cookies and stores nothing on the device, so it loads
 * for everyone. Google Analytics sets cookies, so it only loads once the
 * visitor accepts analytics cookies (UK PECR, EU ePrivacy, GDPR), with
 * Consent Mode denying every advertising use; withdrawing consent turns it
 * off and removes its cookies (lib/consent.ts).
 */
export function Analytics({ settings }: { settings: PublicSettings['analytics'] }) {
  const ga = settings.ga4MeasurementId;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(!!readConsent()?.analytics);
    return onConsentChange((c) => {
      setAllowed(c.analytics);
      if (ga && !c.analytics)
        (window as unknown as Record<string, boolean>)[`ga-disable-${ga}`] = true;
    });
  }, [ga]);

  return (
    <>
      {settings.plausibleDomain && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={settings.plausibleDomain}
          strategy="lazyOnload"
        />
      )}
      {ga && allowed && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`}
            strategy="lazyOnload"
          />
          <Script id="ga4" strategy="lazyOnload">
            {`window['ga-disable-${ga}']=false;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('js',new Date());gtag('config',${JSON.stringify(ga)},{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      )}
    </>
  );
}
