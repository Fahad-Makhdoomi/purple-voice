'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ErrorNote, Modal, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

type Config = Record<string, unknown> | null;

const str = (c: Config, k: string, fallback = '') =>
  typeof c?.[k] === 'string' ? (c[k] as string) : fallback;

/** Sends a test message through a saved integration. */
function TestSend({ type, placeholder }: { type: 'smtp' | 'whatsapp'; placeholder: string }) {
  const [to, setTo] = useState('');
  const { busy, run } = useAction();
  return (
    <div className="rounded-sm border border-line p-4">
      <p className="text-sm font-semibold">Send a test</p>
      <div className="mt-2 flex gap-2">
        <input
          className="input"
          aria-label="Send the test to"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !to}
          onClick={() =>
            run(
              () => api(`/app/integrations/${type}/test`, { body: { to } }),
              'Test sent. Check it arrived.',
            )
          }
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/** Email (SMTP): the subscriber's own mail server, verified by signing in when saved. */
export function SmtpModal({
  open,
  config,
  connected,
  onClose,
  onSaved,
}: {
  open: boolean;
  config: Config;
  connected: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [secure, setSecure] = useState(config?.secure === true);
  const { busy, run } = useAction();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    await run(async () => {
      try {
        await api('/app/integrations/smtp', {
          method: 'PUT',
          body: {
            host: f.get('host'),
            port: Number(f.get('port')),
            secure,
            username: f.get('username') || '',
            password: f.get('password') || '',
            fromEmail: f.get('fromEmail'),
            fromName: f.get('fromName') || '',
            replyTo: f.get('replyTo') || '',
          },
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save');
        throw err;
      }
      await onSaved();
    }, 'Email connected');
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect email (SMTP)" size="lg">
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
        <p className="text-sm text-muted sm:col-span-2">
          Agents send emails from your own mailbox. Use your provider&apos;s SMTP settings: for
          Google Workspace or Gmail, smtp.gmail.com, port 465 and an app password; for Microsoft
          365, smtp.office365.com and port 587. We sign in once to check them.
        </p>
        <Field id="smtp-host" label="Mail server">
          <input
            id="smtp-host"
            name="host"
            className="input font-mono"
            required
            defaultValue={str(config, 'host')}
            placeholder="smtp.gmail.com"
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field id="smtp-port" label="Port">
            <select
              id="smtp-port"
              name="port"
              className="select"
              defaultValue={String(config?.port ?? 587)}
              onChange={(e) => setSecure(e.target.value === '465')}
            >
              {[587, 465, 2525, 25].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <label className="mb-2.5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
            />
            SSL/TLS
          </label>
        </div>
        <Field id="smtp-user" label="Username" optional>
          <input
            id="smtp-user"
            name="username"
            className="input"
            autoComplete="off"
            defaultValue={str(config, 'username')}
            placeholder="sales@yourcompany.com"
          />
        </Field>
        <Field
          id="smtp-pass"
          label="Password"
          help={connected ? 'Leave empty to keep the saved password.' : 'Stored encrypted.'}
          optional={connected}
        >
          <input
            id="smtp-pass"
            name="password"
            type="password"
            className="input"
            autoComplete="new-password"
          />
        </Field>
        <Field id="smtp-from" label="Send from (email)">
          <input
            id="smtp-from"
            name="fromEmail"
            type="email"
            className="input"
            required
            defaultValue={str(config, 'fromEmail')}
            placeholder="sales@yourcompany.com"
          />
        </Field>
        <Field id="smtp-name" label="Sender name" optional>
          <input
            id="smtp-name"
            name="fromName"
            className="input"
            defaultValue={str(config, 'fromName')}
            placeholder="Northwind Solar"
          />
        </Field>
        <Field
          id="smtp-reply"
          label="Replies go to"
          optional
          className="sm:col-span-2"
          help="Where people's replies land, if not the sender address."
        >
          <input
            id="smtp-reply"
            name="replyTo"
            type="email"
            className="input"
            defaultValue={str(config, 'replyTo')}
          />
        </Field>
        {error && (
          <div className="sm:col-span-2">
            <ErrorNote message={error} />
          </div>
        )}
        <div className="flex justify-end sm:col-span-2">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Checking…' : connected ? 'Save' : 'Connect'}
          </button>
        </div>
        {connected && (
          <div className="sm:col-span-2">
            <TestSend type="smtp" placeholder="you@yourcompany.com" />
          </div>
        )}
      </form>
    </Modal>
  );
}

/** WhatsApp Business through Meta's Cloud API or a Twilio WhatsApp sender. */
export function WhatsappModal({
  open,
  config,
  connected,
  onClose,
  onSaved,
}: {
  open: boolean;
  config: Config;
  connected: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [provider, setProvider] = useState<'META' | 'TWILIO'>(
    config?.provider === 'TWILIO' ? 'TWILIO' : 'META',
  );
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();
  const accounts = useApi<{
    accounts: Array<{ id: string; provider: string; label: string | null; publicId: string }>;
  }>('/app/telephony/accounts');
  const twilio = accounts.data?.accounts.filter((a) => a.provider === 'TWILIO') ?? [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    const body =
      provider === 'META'
        ? {
            provider,
            phoneNumberId: f.get('phoneNumberId'),
            accessToken: f.get('accessToken') || '',
            templateName: f.get('templateName') || '',
            templateLanguage: f.get('templateLanguage') || 'en_US',
          }
        : {
            provider,
            telephonyAccountId: f.get('telephonyAccountId'),
            from: f.get('from'),
            contentSid: f.get('contentSid') || '',
          };
    await run(async () => {
      try {
        await api('/app/integrations/whatsapp', { method: 'PUT', body });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save');
        throw err;
      }
      await onSaved();
    }, 'WhatsApp connected');
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect WhatsApp" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="label">Send through</legend>
          {(['META', 'TWILIO'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="chip"
              aria-pressed={provider === p}
              onClick={() => setProvider(p)}
            >
              {p === 'META' ? 'WhatsApp Cloud API (Meta)' : 'Twilio'}
            </button>
          ))}
        </fieldset>
        <p className="rounded-sm bg-brand-50 px-4 py-3 text-sm text-brand-800">
          WhatsApp only lets a business start a conversation with an approved message template.
          Create one with a single variable, for example “Hi, here is the information you asked for
          on our call: {'{{1}}'}”, and add its name below; the agent&apos;s message fills {'{{1}}'}.
          Without a template, messages only reach people who wrote to you in the last 24 hours.
        </p>
        {provider === 'META' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="wa-id" label="Phone number ID" help="WhatsApp Manager → Phone numbers.">
              <input
                id="wa-id"
                name="phoneNumberId"
                className="input font-mono"
                required
                inputMode="numeric"
                defaultValue={str(config, 'phoneNumberId')}
              />
            </Field>
            <Field
              id="wa-token"
              label="Permanent access token"
              help={
                connected
                  ? 'Leave empty to keep the saved token.'
                  : 'A system user token. Stored encrypted.'
              }
              optional={connected}
            >
              <input
                id="wa-token"
                name="accessToken"
                type="password"
                className="input font-mono"
                autoComplete="off"
              />
            </Field>
            <Field id="wa-template" label="Template name" optional>
              <input
                id="wa-template"
                name="templateName"
                className="input font-mono"
                defaultValue={str(config, 'templateName')}
                placeholder="call_follow_up"
              />
            </Field>
            <Field id="wa-lang" label="Template language">
              <input
                id="wa-lang"
                name="templateLanguage"
                className="input font-mono"
                defaultValue={str(config, 'templateLanguage', 'en_US')}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="wa-account"
              label="Twilio account"
              help={
                twilio.length ? undefined : 'Connect a Twilio account under Phone numbers first.'
              }
            >
              <select
                id="wa-account"
                name="telephonyAccountId"
                className="select"
                required
                defaultValue={str(config, 'telephonyAccountId')}
              >
                {twilio.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.publicId}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="wa-from"
              label="WhatsApp sender"
              help="The WhatsApp-enabled number in Twilio."
            >
              <input
                id="wa-from"
                name="from"
                type="tel"
                className="input font-mono"
                required
                defaultValue={str(config, 'from')}
                placeholder="+14155238886"
              />
            </Field>
            <Field
              id="wa-content"
              label="Content template SID"
              optional
              className="sm:col-span-2"
              help="An approved template (HX…) with variable {{1}} for the message."
            >
              <input
                id="wa-content"
                name="contentSid"
                className="input font-mono"
                defaultValue={str(config, 'contentSid')}
                placeholder="HX…"
              />
            </Field>
          </div>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Checking…' : connected ? 'Save' : 'Connect'}
          </button>
        </div>
        {connected && <TestSend type="whatsapp" placeholder="+14155550123" />}
      </form>
    </Modal>
  );
}
