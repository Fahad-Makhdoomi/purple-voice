'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import {
  CREDENTIAL_PROVIDER_LABELS,
  VOICE_ENGINE_LABELS,
  requiredProviders,
  type AiAdminView,
  type AiKeySource,
  type AiSettingsView,
  type CredentialProvider,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ErrorNote, Loading, Section, useAction } from '@/components/ui';
import {
  ApiKeyModal,
  EngineModelFields,
  KEY_USES,
  describeAiSettings,
  pickAiSettings,
  sameAiSettings,
} from '@/components/admin/AiControls';
import { formatDate } from '@/lib/format';

/**
 * Where a key would come from for this subscriber. The API reports it for the
 * saved engine; for vendors only an unsaved engine needs, it is worked out
 * the same way (own key, then platform key).
 */
function keySource(view: AiAdminView, provider: CredentialProvider): AiKeySource | null {
  const reported = view.keys.find((k) => k.provider === provider);
  if (reported) return reported.source;
  if (view.workspaceKeys.some((k) => k.provider === provider)) return 'workspace';
  return view.platformKeys.find((k) => k.provider === provider)?.configured ? 'platform' : null;
}

function KeySourceBadge({ source, last4 }: { source: AiKeySource | null; last4?: string }) {
  switch (source) {
    case 'workspace':
      return (
        <span className="badge badge-success">
          Subscriber&apos;s own key{last4 ? ` ••••${last4}` : ''}
        </span>
      );
    case 'platform':
      return <span className="badge badge-brand">Platform key</span>;
    case 'env':
      return <span className="badge badge-brand">Server environment</span>;
    default:
      return <span className="badge badge-danger">Missing</span>;
  }
}

/**
 * A subscriber's AI layer (Admin → Subscribers → one subscriber). Staff pick
 * the engine and model, or leave the subscriber on the platform default, and
 * can add keys that only this subscriber uses.
 */
export function AiSettingsPanel({ workspaceId }: { workspaceId: string }) {
  const path = `/admin/subscribers/${workspaceId}/ai`;
  const { data, error, setData } = useApi<AiAdminView>(path);
  const [draft, setDraft] = useState<AiSettingsView | null>(null);
  const [keyFor, setKeyFor] = useState<CredentialProvider | null>(null);
  const { busy, run } = useAction();

  // Reset the form only when the saved settings change, so adding or
  // removing a key keeps unsaved engine edits.
  const savedJson = data ? JSON.stringify(pickAiSettings(data.settings)) : null;
  useEffect(() => {
    if (savedJson) setDraft(JSON.parse(savedJson) as AiSettingsView);
  }, [savedJson]);

  if (!data || !draft) {
    return (
      <Section title="AI">
        {error ? <ErrorNote message={error.message} /> : <Loading label="Loading AI settings…" />}
      </Section>
    );
  }

  const saved = pickAiSettings(data.settings);
  const own = data.settings.source === 'workspace';
  const dirty = !sameAiSettings(draft, saved);
  const needed = requiredProviders(draft.voiceEngine, draft.llmProvider);
  const missingNow = data.keys.filter((k) => !k.source).map((k) => k.provider);
  const missingDraft = needed.filter((p) => !keySource(data, p));
  const otherOwnKeys = data.workspaceKeys.filter((k) => !needed.includes(k.provider));
  const label = (p: CredentialProvider) => CREDENTIAL_PROVIDER_LABELS[p];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    await run(async () => {
      setData(await api<AiAdminView>(path, { method: 'PUT', body: draft }));
    }, 'AI settings saved');
  }

  async function revertToDefault() {
    if (
      !window.confirm(
        'Switch this subscriber back to the platform default? Their own AI settings are removed; keys added for them stay.',
      )
    )
      return;
    await run(async () => {
      setData(await api<AiAdminView>(path, { method: 'DELETE' }));
    }, 'Now on the platform default');
  }

  async function removeKey(provider: CredentialProvider) {
    const fallback = data!.platformKeys.find((k) => k.provider === provider)?.configured
      ? 'They fall back to the platform key.'
      : 'There is no platform key to fall back to, so agents that need it stop taking calls.';
    if (!window.confirm(`Remove this subscriber's ${label(provider)} key? ${fallback}`)) return;
    await run(async () => {
      setData(await api<AiAdminView>(`${path}/keys/${provider}`, { method: 'DELETE' }));
    }, 'Key removed');
  }

  return (
    <Section
      title="AI"
      description="Only staff choose a subscriber's AI. The subscriber sees just the voices it offers and whether it's ready, never vendors, models or keys."
      actions={
        <div className="flex flex-wrap gap-2">
          <span className={own ? 'badge badge-brand' : 'badge badge-neutral'}>
            {own ? 'Own settings' : 'Platform default'}
          </span>
          <span className={data.ready ? 'badge badge-success' : 'badge badge-danger'}>
            {data.ready ? 'Ready for calls' : 'Not ready'}
          </span>
        </div>
      }
    >
      {!data.ready && (
        <div className="mb-5 flex gap-3 rounded-sm border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">
              This subscriber&apos;s agents can&apos;t take calls.
            </strong>{' '}
            {VOICE_ENGINE_LABELS[saved.voiceEngine]} is missing a key
            {missingNow.length ? ` (${missingNow.map(label).join(', ')})` : ''}. Add their own key
            below, or ask a super admin to add a platform key under AI providers.
          </p>
        </div>
      )}

      <p className="mb-5 text-sm text-ink-soft">
        {own ? (
          <>
            Own settings: <span className="font-semibold">{describeAiSettings(saved)}</span>.
            Changes to the platform default don&apos;t affect this subscriber.
          </>
        ) : (
          <>
            Follows the platform default:{' '}
            <span className="font-semibold">{describeAiSettings(data.platformDefault)}</span>.
            Saving below gives this subscriber its own settings.
          </>
        )}
      </p>

      <form onSubmit={save} className="space-y-5">
        <EngineModelFields idPrefix="ws-ai" value={draft} onChange={setDraft} disabled={busy} />
        <p className="text-xs text-muted">
          Each engine has its own voices. After a change, agents use the new engine&apos;s default
          voice until the subscriber picks another.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !dirty}>
            Save AI settings
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
          {own && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={revertToDefault}
            >
              <RotateCcw size={16} aria-hidden="true" /> Use platform default
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-semibold">
          {dirty ? 'Keys these settings would need' : 'Keys this engine needs'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          A key added here is used only for this subscriber and takes precedence over the
          platform&apos;s. Its usage is billed to the vendor account it belongs to.
        </p>
        {dirty && missingDraft.length > 0 && (
          <p className="mt-3 text-sm text-warning">
            With these settings these keys would be missing: {missingDraft.map(label).join(', ')}.
            Agents couldn&apos;t take calls until they&apos;re added.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {needed.map((p) => {
            const ownKey = data.workspaceKeys.find((k) => k.provider === p);
            return (
              <li
                key={p}
                className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{label(p)}</p>
                    <KeySourceBadge source={keySource(data, p)} last4={ownKey?.last4} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ownKey
                      ? `${ownKey.label ? `${ownKey.label} · ` : ''}Verified ${formatDate(ownKey.verifiedAt)}`
                      : KEY_USES[p]}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => setKeyFor(p)}
                  >
                    {ownKey ? 'Replace own key' : 'Add own key'}
                  </button>
                  {ownKey && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger"
                      disabled={busy}
                      aria-label={`Remove this subscriber's ${label(p)} key`}
                      onClick={() => removeKey(p)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {otherOwnKeys.length > 0 && (
          <>
            <h4 className="mt-5 text-sm font-semibold text-ink-soft">
              Other keys saved for this subscriber
            </h4>
            <p className="mt-1 text-xs text-muted">Not used by the engine above.</p>
            <ul className="mt-3 space-y-2">
              {otherOwnKeys.map((k) => (
                <li
                  key={k.provider}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold">{label(k.provider)}</span>{' '}
                    <span className="text-muted">
                      ••••{k.last4}
                      {k.label ? ` · ${k.label}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    disabled={busy}
                    aria-label={`Remove this subscriber's ${label(k.provider)} key`}
                    onClick={() => removeKey(k.provider)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ApiKeyModal
        provider={keyFor}
        onClose={() => setKeyFor(null)}
        intro={
          keyFor
            ? `${KEY_USES[keyFor]} Used only for this subscriber, ahead of any platform key.`
            : undefined
        }
        onSave={async (input) =>
          setData(await api<AiAdminView>(`${path}/keys`, { method: 'PUT', body: input }))
        }
      />
    </Section>
  );
}
