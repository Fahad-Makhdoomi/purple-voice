'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Our own cookie-free page-view tracker (API: services/web-analytics.ts).
 * Sends one small request per page view and one when the page is left, for
 * time on page. Stores nothing on the device, so no consent is needed; it
 * still honours Do Not Track and Global Privacy Control.
 */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return;
    if (/^(localhost|127\.)/.test(location.hostname) && process.env.NODE_ENV === 'production')
      return;

    let id: string | null = null;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    let visibleMs = 0;
    let done = false;
    const post = (path: string, body: unknown) =>
      fetch(`/api/public/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit',
      });

    // One view per page: an effect that runs again for the same address
    // (React development mode, or a re-render) reuses the view already sent.
    // Only the first view after a full load carries the external referrer.
    const key = location.pathname + location.search;
    const w = window as unknown as {
      __pvView?: { key: string; at: number; id: Promise<string | null> };
    };
    if (!w.__pvView || w.__pvView.key !== key || Date.now() - w.__pvView.at > 2000) {
      const referrer = w.__pvView ? null : document.referrer || null;
      w.__pvView = {
        key,
        at: Date.now(),
        id: post('collect', {
          path: key,
          referrer,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          width: window.innerWidth,
        })
          .then((r) => r.json() as Promise<{ id: string | null }>)
          .then((r) => r.id)
          .catch(() => null),
      };
    }
    void w.__pvView.id.then((v) => (id = v));

    // Reports cumulative visible time; the server keeps the latest figure, so
    // hiding the tab, coming back and leaving later all count.
    const report = () => {
      if (visibleSince) visibleMs += Date.now() - visibleSince;
      visibleSince = 0;
      if (!id || done) return;
      void post('collect/leave', { id, ms: Math.round(visibleMs) }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report();
      else if (!done) visibleSince = Date.now();
    };
    const leave = () => {
      report();
      done = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [pathname]);

  return null;
}
