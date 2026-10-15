'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Field, FormError } from '@/components/forms/Field';
import { useCaptcha, type CaptchaProvider } from '@/components/forms/useCaptcha';

export function ContactForm({
  plan,
  captcha,
}: {
  plan?: string;
  captcha: { provider: CaptchaProvider; enabled: boolean };
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const cap = useCaptcha({ ...captcha, action: 'contact' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const captchaToken = await cap.getToken();
    if (cap.active && !captchaToken) return setError('Please complete the captcha.');
    setState('sending');
    try {
      await api('/public/contact', {
        body: {
          name: form.get('name'),
          email: form.get('email'),
          company: form.get('company') || undefined,
          phone: form.get('phone') || undefined,
          message: form.get('message'),
          plan: plan === 'ENTERPRISE' || plan === 'PRO' || plan === 'BASIC' ? plan : undefined,
          website: form.get('website') || undefined,
          captchaToken,
        },
      });
      setState('sent');
    } catch (err) {
      setState('idle');
      cap.reset();
      setError(
        err instanceof ApiError ? err.message : 'Could not send your message. Please try again.',
      );
    }
  }

  if (state === 'sent') {
    return (
      <div className="card card-pad flex flex-col items-center py-14 text-center" role="status">
        <CheckCircle2 size={40} className="text-success" aria-hidden="true" />
        <h2 className="mt-4 text-h3">Thanks — we&apos;ll be in touch</h2>
        <p className="mt-2 max-w-sm text-muted">
          A member of the team will reply within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-5" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name">
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className="input"
          />
        </Field>
        <Field id="email" label="Work email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </Field>
        <Field id="company" label="Company" optional>
          <input
            id="company"
            name="company"
            maxLength={160}
            autoComplete="organization"
            className="input"
          />
        </Field>
        <Field id="phone" label="Phone" optional>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            className="input"
          />
        </Field>
      </div>
      <Field id="message" label="How can we help?">
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          className="textarea"
          placeholder={
            plan === 'ENTERPRISE' ? 'Call volumes, number of agents, systems to integrate…' : ''
          }
        />
      </Field>
      {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {cap.element}
      <FormError message={error} />
      <button
        type="submit"
        className="btn btn-primary btn-lg w-full sm:w-auto"
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
