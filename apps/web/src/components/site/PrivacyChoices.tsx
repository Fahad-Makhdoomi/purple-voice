'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  PRIVACY_REGIONS,
  PRIVACY_REGION_LABELS,
  PRIVACY_REQUEST_LABELS,
  PRIVACY_REQUEST_TYPES,
} from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import {
  gpcEnabled,
  onConsentChange,
  openCookieSettings,
  readConsent,
  type Consent,
} from '@/lib/consent';
import { Field, FormError } from '@/components/forms/Field';
import { useCaptcha, type CaptchaProvider } from '@/components/forms/useCaptcha';

/** The visitor's current cookie choice and Global Privacy Control status. */
export function ConsentStatus() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [gpc, setGpc] = useState(false);
  useEffect(() => {
    setConsent(readConsent());
    setGpc(gpcEnabled());
    return onConsentChange(setConsent);
  }, []);
  return (
    <div className="card card-pad space-y-4">
      <h2 className="text-h3">Cookies on this device</h2>
      <p className="text-ink-soft">
        {consent
          ? `Analytics cookies are ${consent.analytics ? 'on' : 'off'}; marketing cookies are ${consent.marketing ? 'on' : 'off'}.`
          : 'You have not made a choice yet, so only strictly necessary cookies are used.'}
      </p>
      {gpc && (
        <p className="flex gap-2 rounded-sm bg-success/10 px-3 py-2 text-sm text-success">
          <ShieldCheck size={18} className="shrink-0" aria-hidden="true" />
          Your browser sends a Global Privacy Control signal. We treat it as a request not to sell
          or share your information and keep marketing cookies off.
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={openCookieSettings}>
        Change cookie settings
      </button>
    </div>
  );
}

/** Access, deletion, correction, opt-out and other privacy rights requests. */
export function PrivacyRequestForm({
  captcha,
}: {
  captcha: { provider: CaptchaProvider; enabled: boolean };
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const cap = useCaptcha({ ...captcha, action: 'contact' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const captchaToken = await cap.getToken();
    if (cap.active && !captchaToken) return setError('Please complete the captcha.');
    setState('sending');
    try {
      await api('/public/privacy-request', {
        body: {
          name: f.get('name'),
          email: f.get('email'),
          type: f.get('type'),
          region: f.get('region'),
          onBehalf: f.get('onBehalf') === 'on',
          details: f.get('details') || undefined,
          website: f.get('website') || undefined,
          captchaToken,
        },
      });
      setState('sent');
    } catch (err) {
      setState('idle');
      cap.reset();
      setError(err instanceof ApiError ? err.message : 'Could not send your request.');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card card-pad flex flex-col items-center py-14 text-center" role="status">
        <CheckCircle2 size={40} className="text-success" aria-hidden="true" />
        <h2 className="mt-4 text-h3">Request received</h2>
        <p className="mt-2 max-w-sm text-muted">
          We have emailed you a confirmation. We may ask you to confirm it is you, and we reply
          within one month (45 days for US requests).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-5">
      <h2 className="text-h3">Make a privacy request</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pr-name" label="Your name">
          <input
            id="pr-name"
            name="name"
            required
            minLength={2}
            className="input"
            autoComplete="name"
          />
        </Field>
        <Field id="pr-email" label="Email">
          <input
            id="pr-email"
            name="email"
            type="email"
            required
            className="input"
            autoComplete="email"
          />
        </Field>
        <Field id="pr-type" label="What would you like?">
          <select id="pr-type" name="type" className="select" required>
            {PRIVACY_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRIVACY_REQUEST_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pr-region" label="Where do you live?">
          <select id="pr-region" name="region" className="select" required>
            {PRIVACY_REGIONS.map((r) => (
              <option key={r} value={r}>
                {PRIVACY_REGION_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        id="pr-details"
        label="Details"
        optional
        help="Anything that helps us find your information, e.g. the phone number a business called you on."
      >
        <textarea id="pr-details" name="details" maxLength={5000} className="textarea" />
      </Field>
      <label className="flex items-start gap-2.5 text-sm text-ink-soft">
        <input type="checkbox" name="onBehalf" className="checkbox mt-0.5" />
        <span>I am an authorised agent making this request for someone else.</span>
      </label>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="pr-website">Website</label>
        <input id="pr-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {cap.element}
      <FormError message={error} />
      <button className="btn btn-primary btn-lg" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send request'}
      </button>
      <p className="text-xs text-muted">
        We use these details only to handle your request and keep a record of it.
      </p>
    </form>
  );
}
