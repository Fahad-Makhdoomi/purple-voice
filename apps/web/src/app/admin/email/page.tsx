'use client';

import { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import type { EmailSettingsView } from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ErrorNote, Loading, PageHeader, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

const SOURCE_NOTE: Record<EmailSettingsView['source'], string> = {
  database: 'Email is sent with the settings saved on this page.',
  environment:
    'Email is sent with the server’s SMTP_* settings. Save settings here to take over from them.',
  none: 'No mail server is set up, so password reset links and notifications are not being sent. Fill this in to start sending.',
};

export default function EmailSettingsPage() {
  const { data, setData } = useApi<{ settings: EmailSettingsView }>('/admin/super/email');
  const [form, setForm] = useState<{
    host: string;
    port: string;
    secure: boolean;
    username: string;
    password: string;
    from: string;
    supportEmails: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    const s = data?.settings;
    if (s)
      setForm({
        host: s.host,
        port: String(s.port),
        secure: s.secure,
        username: s.username,
        password: '',
        from: s.from,
        supportEmails: s.supportEmails,
      });
  }, [data]);

  if (!form || !data) return <Loading />;
  const settings = data.settings;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm({ ...form, [key]: value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    await run(async () => {
      try {
        const r = await api<{ settings: EmailSettingsView }>('/admin/super/email', {
          method: 'PUT',
          body: { ...form, port: Number(form.port) },
        });
        setData(r);
        toast('Email settings saved');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save the settings');
      }
    });
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setTestError(null);
    await run(async () => {
      try {
        await api('/admin/super/email/test', { body: { to: testTo } });
        toast(`Test email sent to ${testTo}`);
      } catch (err) {
        setTestError(err instanceof ApiError ? err.message : 'Could not send the test email');
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Email (SMTP)"
        description="The mail server that sends password reset links, notifications and support alerts."
      />
      <div className="grid max-w-3xl gap-6">
        <p
          className={
            settings.source === 'none'
              ? 'rounded-sm border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger'
              : 'rounded-sm border border-line bg-surface-2 px-4 py-3 text-sm'
          }
        >
          {SOURCE_NOTE[settings.source]}
        </p>

        <Section
          title="Mail server"
          description="We sign in to the server when you save, so a wrong host or password is caught straight away."
        >
          <form onSubmit={save} className="space-y-4">
            {error && <ErrorNote message={error} />}
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field id="smtp-host" label="Server" help="For example smtp.gmail.com or smtp.sendgrid.net.">
                <input
                  id="smtp-host"
                  className="input"
                  required
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field id="smtp-port" label="Port">
                <input
                  id="smtp-port"
                  type="number"
                  className="input"
                  required
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => {
                    const port = e.target.value;
                    setForm({ ...form, port, secure: port === '465' ? true : form.secure });
                  }}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => set('secure', e.target.checked)}
              />
              Use SSL from the start (port 465). Leave off for port 587, which upgrades to TLS.
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="smtp-user" label="Username" optional>
                <input
                  id="smtp-user"
                  className="input"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="smtp-pass"
                label="Password"
                optional
                help={
                  settings.hasPassword
                    ? 'A password is saved. Leave blank to keep it.'
                    : 'Gmail and Outlook need an app password, not your normal one.'
                }
              >
                <input
                  id="smtp-pass"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={settings.hasPassword ? '••••••••' : ''}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <Field
              id="smtp-from"
              label="Send from"
              help="Most providers only allow an address on a domain you have verified with them."
            >
              <input
                id="smtp-from"
                className="input"
                required
                value={form.from}
                onChange={(e) => set('from', e.target.value)}
                placeholder="Purple Voice <no-reply@yourdomain.com>"
              />
            </Field>
            <Field
              id="smtp-support"
              label="Support alerts go to"
              optional
              help="Separate addresses with commas. These people are emailed when a customer opens or answers a ticket."
            >
              <input
                id="smtp-support"
                className="input"
                value={form.supportEmails}
                onChange={(e) => set('supportEmails', e.target.value)}
                placeholder="support@yourdomain.com"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={busy}>
                Save and verify
              </button>
              {settings.source === 'database' && (
                <button
                  type="button"
                  className="btn btn-ghost text-danger"
                  disabled={busy}
                  onClick={() =>
                    window.confirm('Stop using these settings and fall back to the server’s?') &&
                    run(async () => {
                      const r = await api<{ settings: EmailSettingsView }>('/admin/super/email', {
                        method: 'DELETE',
                      });
                      setData(r);
                    }, 'Saved email settings removed')
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
          </form>
        </Section>

        <Section
          title="Send a test email"
          description="Sends a short message with the saved settings, so you can see it arrive."
        >
          <form onSubmit={sendTest} className="space-y-4">
            {testError && <ErrorNote message={testError} />}
            <Field id="smtp-test" label="Send to">
              <input
                id="smtp-test"
                type="email"
                className="input"
                required
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@yourdomain.com"
              />
            </Field>
            <button className="btn btn-secondary" disabled={busy || settings.source === 'none'}>
              <Send size={14} aria-hidden="true" /> Send test email
            </button>
          </form>
        </Section>
      </div>
    </>
  );
}
