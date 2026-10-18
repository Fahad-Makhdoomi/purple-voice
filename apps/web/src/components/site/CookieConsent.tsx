'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import {
  gpcEnabled,
  onOpenCookieSettings,
  openCookieSettings,
  readConsent,
  saveConsent,
} from '@/lib/consent';

/** A cookie with a bite out of it, wobbling and dropping crumbs (all CSS, stops under reduced motion). */
function CookieArt() {
  const mask = useId();
  return (
    <svg viewBox="0 0 48 48" className="cookie-art" aria-hidden="true">
      <defs>
        <mask id={mask}>
          <rect width="48" height="48" fill="white" />
          <circle cx="38.5" cy="11" r="7.5" fill="black" />
          <circle cx="31" cy="6.5" r="4" fill="black" />
        </mask>
      </defs>
      <g className="cookie-art__body">
        <g mask={`url(#${mask})`}>
          <circle cx="24" cy="25" r="17" fill="#C98B4B" />
          <circle cx="24" cy="25" r="15" fill="#E7B56E" />
          <path
            d="M11 26c3 6 9 9 15 9"
            stroke="#D49A55"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="17" cy="20" rx="2.4" ry="2" fill="#5A3519" />
          <ellipse cx="27" cy="18" rx="1.8" ry="1.5" fill="#5A3519" />
          <ellipse cx="21" cy="30" rx="2.2" ry="1.8" fill="#5A3519" />
          <ellipse cx="30" cy="28" rx="2.5" ry="2" fill="#5A3519" />
          <ellipse cx="14" cy="27" rx="1.4" ry="1.2" fill="#5A3519" />
          <ellipse cx="25" cy="36" rx="1.5" ry="1.2" fill="#5A3519" />
        </g>
      </g>
      <circle className="cookie-art__crumb" cx="36" cy="18" r="1.3" fill="#E7B56E" />
      <circle className="cookie-art__crumb" cx="33" cy="15" r="1" fill="#C98B4B" />
      <circle className="cookie-art__crumb" cx="39" cy="16" r="0.9" fill="#E7B56E" />
    </svg>
  );
}

function Switch({
  id,
  checked,
  disabled,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}) {
  return (
    <span className="cookie-switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span aria-hidden="true" />
    </span>
  );
}

/**
 * The cookie toaster: a small dark pill at the bottom of the page with a
 * one-line message and three equal choices — necessary only, preferences,
 * accept. Optional cookies (analytics, marketing) wait for a choice; the
 * footer's "Cookie settings" reopens it.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [panel, setPanel] = useState(false);
  const [gpc, setGpc] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setGpc(gpcEnabled());
    const current = readConsent();
    const t = current ? undefined : window.setTimeout(() => setOpen(true), 700);
    const off = onOpenCookieSettings(() => {
      const c = readConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setLeaving(false);
      setPanel(true);
      setOpen(true);
    });
    return () => {
      if (t) window.clearTimeout(t);
      off();
    };
  }, []);

  if (!open) return null;

  const close = (choice: { analytics: boolean; marketing: boolean }) => {
    saveConsent(choice);
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setPanel(false);
      setLeaving(false);
    }, 380);
  };

  return (
    <div
      className={`cookie-toast${leaving ? ' is-leaving' : ''}`}
      role="region"
      aria-label="Cookie choices"
    >
      {panel && (
        <div className="cookie-panel" role="dialog" aria-labelledby={titleId}>
          <p id={titleId} className="cookie-panel__title">
            Your cookie choices
          </p>
          <ul className="cookie-panel__list">
            <li>
              <div>
                <p className="cookie-panel__name">Strictly necessary</p>
                <p className="cookie-panel__desc">
                  Sign-in, security and remembering this choice. Always on.
                </p>
              </div>
              <Switch id="ck-necessary" checked disabled label="Strictly necessary cookies" />
            </li>
            <li>
              <div>
                <p className="cookie-panel__name">Analytics</p>
                <p className="cookie-panel__desc">
                  Google Analytics counts visits so we can improve the site.
                </p>
              </div>
              <Switch
                id="ck-analytics"
                checked={analytics}
                onChange={setAnalytics}
                label="Analytics cookies"
              />
            </li>
            <li>
              <div>
                <p className="cookie-panel__name">Marketing</p>
                <p className="cookie-panel__desc">
                  {gpc
                    ? 'Off: your browser sent a Global Privacy Control signal.'
                    : 'Not used today. We will ask before adding any.'}
                </p>
              </div>
              <Switch
                id="ck-marketing"
                checked={marketing && !gpc}
                disabled={gpc}
                onChange={setMarketing}
                label="Marketing cookies"
              />
            </li>
          </ul>
          <div className="cookie-panel__actions">
            <button
              type="button"
              className="cookie-link"
              onClick={() => close({ analytics: false, marketing: false })}
            >
              Reject all
            </button>
            <button
              type="button"
              className="cookie-link cookie-link--accent"
              onClick={() => close({ analytics, marketing })}
            >
              Save choices
            </button>
          </div>
        </div>
      )}
      <div className="cookie-toast__inner">
        <span className="cookie-toast__tile">
          <CookieArt />
        </span>
        <div className="min-w-0">
          <p className="cookie-toast__text">
            Hi! Cookies keep things running; analytics only if you say yes.{' '}
            <Link href="/cookies" className="cookie-toast__policy">
              Cookie policy
            </Link>
          </p>
          <div className="cookie-toast__actions">
            <button
              type="button"
              className="cookie-link"
              onClick={() => close({ analytics: false, marketing: false })}
            >
              Necessary only
            </button>
            <button
              type="button"
              className="cookie-link"
              aria-expanded={panel}
              onClick={() => setPanel((p) => !p)}
            >
              Preferences
            </button>
            <button
              type="button"
              className="cookie-link cookie-link--accent"
              onClick={() => close({ analytics: true, marketing: !gpc })}
            >
              Accept &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Cookie settings" in the footer and on the privacy choices page. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Cookie settings
    </button>
  );
}
