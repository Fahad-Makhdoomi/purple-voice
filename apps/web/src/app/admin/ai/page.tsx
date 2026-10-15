'use client';

import { useEffect, useState } from 'react';
import { Check, KeyRound, Lock, ServerCog, Trash2 } from 'lucide-react';
import {
  CREDENTIAL_PROVIDER_LABELS,
  isSuperAdmin,
  requiredProviders,
  type AiSettingsView,
  type CredentialProvider,
  type PlatformAiView,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { EmptyState, ErrorNote, Loading, PageHeader, Section, useAction } from '@/components/ui';
import {
  ApiKeyModal,
  EngineModelFields,
  KEY_USES,
  pickAiSettings,
  sameAiSettings,
} from '@/components/admin/AiControls';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

const TITLE = 'AI providers';
const DESCRIPTION =
  'The vendor keys the platform provides, and the AI every subscriber uses unless staff give them their own settings.';

/** Super admin → AI providers: platform-wide vendor keys and the default AI layer. */
export default function AiProvidersPage() {
  const { me } = useSession();
  // The API enforces this; the check only spares admins a page that can't load.
  const allowed = !!me && isSuperAdmin(me.user.role);
  const { data, error, setData } = useApi<PlatformAiView>(allowed ? '/admin/super/ai' : null);
  const [draft, setDraft] = useState<AiSettingsView | null>(null);
  const [keyFor, setKeyFor] = useState<CredentialProvider | null>(null);
  const { busy, run } = useAction();

  // Reset the form only when the saved default changes, so key edits keep unsaved changes.
  const savedJson = data ? JSON.stringify(pickAiSettings(data.defaults)) : null;
  useEffect(() => {
    if (savedJson) setDraft(JSON.parse(savedJson) as AiSettingsView);
  }, [savedJson]);

  if (me && !allowed) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={Lock}
          title="Super admins only"
          body="Platform keys and the default AI are managed by super admins. You can still set up one subscriber's AI from their page under Subscribers."
        />
      </>
    );
  }
  if (!data || !draft) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        {error ? <ErrorNote message={error.message} /> : <Loading />}
      </>
    );
  }

  const saved = pickAiSettings(data.defaults);
  const dirty = !sameAiSettings(draft, saved);
  const usedByDefault = requiredProviders(saved.voiceEngine, saved.llmProvider);
  const needed = requiredProviders(draft.voiceEngine, draft.llmProvider);
  const label = (p: CredentialProvider) => CREDENTIAL_PROVIDER_LABELS[p];
  const available = (p: CredentialProvider) =>
    data.keys.some((k) => k.provider === p && k.configured) ||
    (p === 'ANTHROPIC' && data.envAnthropic);
  const missingNeeded = needed.filter((p) => !available(p));

  async function saveDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    await run(async () => {
      setData(
        await api<PlatformAiView>('/admin/super/ai/defaults', { method: 'PUT', body: draft }),
      );
    }, 'Default AI saved');
  }

  async function removeKey(provider: CredentialProvider) {
    const fallback =
      provider === 'ANTHROPIC' && data!.envAnthropic
        ? 'Claude falls back to the server’s ANTHROPIC_API_KEY.'
        : `Subscribers without their own ${label(provider)} key can’t take calls on engines that need it.`;
    if (!window.confirm(`Remove the platform ${label(provider)} key? ${fallback}`)) return;
    await run(async () => {
      setData(await api<PlatformAiView>(`/admin/super/ai/keys/${provider}`, { method: 'DELETE' }));
    }, 'Platform key removed');
  }

  return (
    <>
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <div className="grid max-w-4xl gap-6">
        <Section
          title="Platform keys"
          description="Used for every subscriber without a key of their own, and billed to the platform's vendor accounts. Each key is checked with the vendor before it's saved, then encrypted; it's never shown again."
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {data.keys.map((k) => {
              const env = !k.configured && k.provider === 'ANTHROPIC' && data.envAnthropic;
              const ok = k.configured || env;
              const inUse = usedByDefault.includes(k.provider);
              return (
                <li
                  key={k.provider}
                  className="flex flex-col gap-3 rounded-lg border border-line p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        ok ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700',
                      )}
                    >
                      {env ? (
                        <ServerCog size={18} aria-hidden="true" />
                      ) : ok ? (
                        <Check size={18} aria-hidden="true" />
                      ) : (
                        <KeyRound size={18} aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{label(k.provider)}</p>
                        {inUse && (
                          <span className={ok ? 'badge badge-brand' : 'badge badge-danger'}>
                            {ok ? 'Used by default' : 'Needed by default'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">
                        {k.configured
                          ? `Key ending ${k.last4}${k.label ? ` · ${k.label}` : ''}`
                          : env
                            ? 'Using ANTHROPIC_API_KEY from the server environment'
                            : 'Not set'}
                      </p>
                      {k.configured && (
                        <p className="text-xs text-muted">
                          Verified {formatDate(k.verifiedAt)}
                          {k.provider === 'ANTHROPIC' && data.envAnthropic
                            ? ' · used instead of the server’s ANTHROPIC_API_KEY'
                            : ''}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted">{KEY_USES[k.provider]}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:pl-[52px]">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => setKeyFor(k.provider)}
                    >
                      {k.configured ? 'Replace key' : 'Add key'}
                    </button>
                    {k.configured && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-danger"
                        disabled={busy}
                        aria-label={`Remove the platform ${label(k.provider)} key`}
                        onClick={() => removeKey(k.provider)}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          title="Default AI for subscribers"
          description="Every subscriber without their own settings uses this. To set one subscriber up differently, open them under Subscribers and use their AI section."
        >
          <form onSubmit={saveDefaults} className="space-y-5">
            <EngineModelFields
              idPrefix="default-ai"
              value={draft}
              onChange={setDraft}
              disabled={busy}
            />
            <div className="rounded-lg border border-line p-4 text-sm">
              <p className="font-semibold">Platform keys this needs</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {needed.map((p) => (
                  <li key={p}>
                    <span className={available(p) ? 'badge badge-success' : 'badge badge-danger'}>
                      {label(p)}: {available(p) ? 'set' : 'missing'}
                    </span>
                  </li>
                ))}
              </ul>
              {missingNeeded.length > 0 && (
                <p className="mt-3 text-warning">
                  Add the missing key above, or subscribers on the default can only take calls if
                  staff added their own key.
                </p>
              )}
            </div>
            <p className="text-xs text-muted">
              Each engine has its own voices. After a change, agents use the new engine&apos;s
              default voice until their owner picks another.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={busy || !dirty}>
                Save default
              </button>
              {dirty && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setDraft(saved)}
                >
                  Discard changes
                </button>
              )}
            </div>
          </form>
        </Section>
      </div>

      <ApiKeyModal
        provider={keyFor}
        onClose={() => setKeyFor(null)}
        intro={
          keyFor
            ? `${KEY_USES[keyFor]} Used for every subscriber without their own ${label(keyFor)} key.`
            : undefined
        }
        onSave={async (input) =>
          setData(await api<PlatformAiView>('/admin/super/ai/keys', { method: 'PUT', body: input }))
        }
      />
    </>
  );
}
