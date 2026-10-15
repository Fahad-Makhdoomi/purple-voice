'use client';

import { useEffect, useState } from 'react';
import { CAPTCHA_FORMS, type SecuritySettings } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';

const LABELS: Record<(typeof CAPTCHA_FORMS)[number], string> = {
  signup: 'Sign-up form',
  login: 'Sign-in form',
  forgotPassword: 'Forgot-password form',
  contact: 'Contact / Enterprise form',
};

export default function SecurityPage() {
  const { data } = useApi<{ value: SecuritySettings }>('/admin/super/settings/security');
  const site = useApi<{ captcha: { provider: string } }>('/public/settings');
  const [value, setValue] = useState<SecuritySettings | null>(null);
  const { busy, run } = useAction();
  useEffect(() => setValue(data?.value ?? null), [data]);
  if (!value || !site.data) return <Loading />;
  const provider = site.data.captcha.provider;

  return (
    <>
      <PageHeader
        title="Security"
        description="Bot protection for public forms. Rate limiting, CSRF checks and encrypted secrets are always on."
      />
      <div className="grid max-w-3xl gap-6">
        <Section title="Captcha" description="Choose which forms ask for a captcha.">
          <p
            className={`mb-5 rounded-sm px-4 py-3 text-sm ${provider === 'none' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}
          >
            {provider === 'none'
              ? 'No captcha provider is configured on the server, so these toggles have no effect yet. Set CAPTCHA_PROVIDER (turnstile, recaptcha or hcaptcha), CAPTCHA_SECRET_KEY and NEXT_PUBLIC_CAPTCHA_SITE_KEY — see DEPLOYMENT.md.'
              : `Provider: ${provider}. Toggles take effect immediately.`}
          </p>
          <ul className="space-y-3">
            {CAPTCHA_FORMS.map((form) => (
              <li key={form}>
                <label className="flex items-center justify-between gap-4 rounded-lg border border-line p-4">
                  <span className="font-medium">{LABELS[form]}</span>
                  <input
                    type="checkbox"
                    className="checkbox h-5 w-5"
                    checked={value.captcha[form]}
                    onChange={(e) =>
                      setValue({ captcha: { ...value.captcha, [form]: e.target.checked } })
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
          <button
            className="btn btn-primary mt-5"
            disabled={busy}
            onClick={() =>
              run(
                () => api('/admin/super/settings/security', { method: 'PUT', body: value }),
                'Security settings saved',
              )
            }
          >
            Save
          </button>
        </Section>
        <Section title="Always on">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>
              Rate limits on sign-in, sign-up, password reset, public forms, the developer API and
              the AI assistant.
            </li>
            <li>Parameterised database queries only (Prisma) — no string-built SQL.</li>
            <li>
              Content Security Policy, frame blocking, HSTS (via nginx) and strict referrer policy.
            </li>
            <li>
              HTTP-only, SameSite session cookies with rotating refresh tokens and reuse detection,
              plus an Origin check on every write.
            </li>
            <li>
              AES-256-GCM encryption for API keys, carrier tokens and OAuth tokens; signed carrier
              callback URLs.
            </li>
            <li>Outbound webhooks blocked from reaching private networks.</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
