'use client';

import { useCallback, useEffect, useRef } from 'react';
import { captchaSiteKey } from '@/lib/config';

export type CaptchaProvider = 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha';

type Widget = {
  render(el: HTMLElement, opts: Record<string, unknown>): string | number;
  reset(id?: string | number): void;
};
declare global {
  interface Window {
    turnstile?: Widget;
    hcaptcha?: Widget;
    grecaptcha?: {
      ready(cb: () => void): void;
      execute(key: string, opts: { action: string }): Promise<string>;
    };
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.defer = true;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error('Captcha failed to load'));
        document.head.appendChild(el);
      }),
    );
  }
  return scripts.get(src)!;
}

/**
 * Captcha for a public form. Which provider runs, and whether this form
 * needs one at all, is decided by the server (env keys + Admin → Security);
 * the provider's script is only downloaded on forms that use it, so pages
 * without a captcha pay nothing for it.
 */
export function useCaptcha({
  provider,
  enabled,
  action,
}: {
  provider: CaptchaProvider;
  enabled: boolean;
  action: string;
}) {
  const active = enabled && provider !== 'none' && !!captchaSiteKey;
  const container = useRef<HTMLDivElement>(null);
  const token = useRef<string | null>(null);
  const widgetId = useRef<string | number | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const setToken = (t: string | null) => (token.current = t);

    (async () => {
      if (provider === 'recaptcha') {
        await loadScript(
          `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(captchaSiteKey)}`,
        );
        return;
      }
      const src =
        provider === 'turnstile'
          ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
          : 'https://js.hcaptcha.com/1/api.js?render=explicit';
      await loadScript(src);
      const api = provider === 'turnstile' ? window.turnstile : window.hcaptcha;
      if (cancelled || !api || !container.current || widgetId.current !== null) return;
      widgetId.current = api.render(container.current, {
        sitekey: captchaSiteKey,
        callback: setToken,
        'expired-callback': () => setToken(null),
        'error-callback': () => setToken(null),
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [active, provider]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!active) return undefined;
    if (provider === 'recaptcha') {
      const g = window.grecaptcha;
      if (!g) return undefined;
      await new Promise<void>((r) => g.ready(r));
      return g.execute(captchaSiteKey, { action });
    }
    return token.current ?? undefined;
  }, [active, provider, action]);

  const reset = useCallback(() => {
    token.current = null;
    const api =
      provider === 'turnstile'
        ? window.turnstile
        : provider === 'hcaptcha'
          ? window.hcaptcha
          : undefined;
    if (api && widgetId.current !== null) api.reset(widgetId.current);
  }, [provider]);

  const element =
    active && provider !== 'recaptcha' ? <div ref={container} className="min-h-[65px]" /> : null;
  return { active, element, getToken, reset };
}
