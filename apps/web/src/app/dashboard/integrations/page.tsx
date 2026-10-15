'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CalendarDays, Check, KeyRound, Trash2 } from 'lucide-react';
import {
  CREDENTIAL_PROVIDER_LABELS,
  INTEGRATION_LABELS,
  type CredentialProvider,
  type IntegrationType,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { Loading, Modal, PageHeader, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatRelative } from '@/lib/format';

interface Credential {
  provider: CredentialProvider;
  connected: boolean;
  last4: string | null;
  verifiedAt: string | null;
}

const KEY_HELP: Record<CredentialProvider, string> = {
  OPENAI: 'Powers the Realtime engine, and GPT models on the Cascaded engine.',
  ANTHROPIC: 'Claude models on the Cascaded engine.',
  GEMINI: 'Gemini models on the Cascaded engine.',
  DEEPGRAM: 'Speech-to-text and voices for the Cascaded engine.',
};

const APP_HELP: Partial<Record<IntegrationType, { label: string; placeholder: string }>> = {
  SLACK: { label: 'Incoming webhook URL', placeholder: 'https://hooks.slack.com/services/…' },
  ZAPIER: { label: 'Catch hook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/…' },
  HUBSPOT: { label: 'Private app access token', placeholder: 'pat-…' },
  CALENDLY: { label: 'Personal access token', placeholder: 'eyJ…' },
};

function IntegrationsInner() {
  const params = useSearchParams();
  const { entitlements, usage, reload: reloadWs } = useWorkspace();
  const creds = useApi<{ credentials: Credential[] }>('/app/credentials');
  const apps = useApi<{
    integrations: Array<{
      id: string;
      type: IntegrationType;
      accountLabel: string | null;
      connectedAt: string;
      lastError: string | null;
    }>;
    available: Array<{ type: IntegrationType; connected: boolean; configured: boolean }>;
  }>('/app/integrations');
  const [keyFor, setKeyFor] = useState<CredentialProvider | null>(null);
  const [appFor, setAppFor] = useState<IntegrationType | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (params.get('connected') === 'google') toast('Google Calendar connected');
    if (params.get('error')) toast('Google Calendar was not connected. Please try again.', 'error');
  }, [params]);

  if (!creds.data || !apps.data) return <Loading />;
  const refreshApps = async () => {
    await Promise.all([apps.reload(), reloadWs()]);
  };
  const limit = entitlements.limits.integrations;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Your own AI keys, calendar and the apps your calls should talk to."
      />
      <div className="space-y-6">
        <Section
          title="AI and speech keys"
          description="Bring your own keys. Usage is billed by each provider; keys are encrypted and never shown again."
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {creds.data.credentials.map((c) => (
              <li
                key={c.provider}
                className="flex items-center gap-4 rounded-lg border border-line p-4"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.connected ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700'}`}
                >
                  {c.connected ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <KeyRound size={18} aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{CREDENTIAL_PROVIDER_LABELS[c.provider]}</p>
                  <p className="text-xs text-muted">
                    {c.connected
                      ? `Key ending ${c.last4} · checked ${formatRelative(c.verifiedAt)}`
                      : KEY_HELP[c.provider]}
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setKeyFor(c.provider)}>
                  {c.connected ? 'Replace' : 'Add key'}
                </button>
                {c.connected && (
                  <button
                    className="btn btn-ghost btn-icon h-9 w-9 text-danger"
                    aria-label={`Remove ${CREDENTIAL_PROVIDER_LABELS[c.provider]} key`}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        if (
                          !window.confirm('Remove this key? Agents that use it will stop working.')
                        )
                          return;
                        await api(`/app/credentials/${c.provider}`, { method: 'DELETE' });
                        await creds.reload();
                      }, 'Key removed')
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Apps"
          description={
            limit === null
              ? 'Connect as many as you need.'
              : `${usage.integrations} of ${limit} connected on your plan.`
          }
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {apps.data.available.map((a) => {
              const connected = apps.data!.integrations.find((i) => i.type === a.type);
              return (
                <li
                  key={a.type}
                  className="flex items-center gap-4 rounded-lg border border-line p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <CalendarDays size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{INTEGRATION_LABELS[a.type]}</p>
                    <p className="truncate text-xs text-muted">
                      {connected
                        ? connected.lastError
                          ? `Problem: ${connected.lastError}`
                          : `Connected${connected.accountLabel ? ` as ${connected.accountLabel}` : ''}`
                        : !a.configured
                          ? 'Not available on this server yet'
                          : a.type === 'GOOGLE_CALENDAR'
                            ? 'Let agents check availability and book meetings.'
                            : a.type === 'SLACK'
                              ? 'Post call results to a channel (via Automations).'
                              : a.type === 'ZAPIER'
                                ? 'Every call and booking event is sent to your Zap.'
                                : 'Save your token now; contact sync is coming soon.'}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      className="btn btn-ghost btn-sm text-danger"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (!window.confirm(`Disconnect ${INTEGRATION_LABELS[a.type]}?`)) return;
                          await api(`/app/integrations/${connected.id}`, { method: 'DELETE' });
                          await refreshApps();
                        }, 'Disconnected')
                      }
                    >
                      Disconnect
                    </button>
                  ) : a.type === 'GOOGLE_CALENDAR' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy || !a.configured || !entitlements.active}
                      onClick={() =>
                        run(async () => {
                          const { url } = await api<{ url: string }>(
                            '/app/integrations/google/connect',
                          );
                          window.location.href = url;
                        })
                      }
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!entitlements.active}
                      onClick={() => setAppFor(a.type)}
                    >
                      Connect
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <Modal
        open={!!keyFor}
        onClose={() => setKeyFor(null)}
        title={keyFor ? `${CREDENTIAL_PROVIDER_LABELS[keyFor]} API key` : ''}
      >
        {keyFor && (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const apiKey = String(new FormData(e.currentTarget).get('apiKey') ?? '');
              const ok = await run(async () => {
                await api('/app/credentials', {
                  method: 'PUT',
                  body: { provider: keyFor, apiKey },
                });
                return true;
              }, 'Key verified and saved');
              if (ok) {
                setKeyFor(null);
                await creds.reload();
              }
            }}
          >
            <p className="text-sm text-muted">
              {KEY_HELP[keyFor]} We make one test request to check the key before saving it.
            </p>
            <Field id="apiKey" label="API key">
              <input
                id="apiKey"
                name="apiKey"
                type="password"
                className="input font-mono"
                required
                minLength={8}
                autoComplete="off"
              />
            </Field>
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Save key'}
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={!!appFor}
        onClose={() => setAppFor(null)}
        title={appFor ? `Connect ${INTEGRATION_LABELS[appFor]}` : ''}
      >
        {appFor && APP_HELP[appFor] && (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const secret = String(new FormData(e.currentTarget).get('secret') ?? '');
              const ok = await run(async () => {
                await api('/app/integrations', { body: { type: appFor, secret } });
                return true;
              }, 'Connected');
              if (ok) {
                setAppFor(null);
                await refreshApps();
              }
            }}
          >
            <Field id="secret" label={APP_HELP[appFor]!.label}>
              <input
                id="secret"
                name="secret"
                className="input font-mono"
                required
                placeholder={APP_HELP[appFor]!.placeholder}
                autoComplete="off"
              />
            </Field>
            <button className="btn btn-primary w-full" disabled={busy}>
              Connect
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <IntegrationsInner />
    </Suspense>
  );
}
