'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  CALL_OUTCOMES,
  CRM_STAGE_COLORS,
  CRM_STAGE_KINDS,
  type CallOutcome,
  type CrmSettingsView,
  type CrmStageColor,
  type CrmStageKind,
  type CrmStageView,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import { humanize } from '@/lib/format';
import { Loading, PageHeader, Section, UpgradeGate, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { StageDot, useCallingSetup } from '@/components/crm/CrmParts';

const KIND_LABELS: Record<CrmStageKind, string> = { OPEN: 'Open', WON: 'Won', LOST: 'Lost' };

export default function CrmSettingsPage() {
  const allowed = useFeature('crm');
  if (!allowed) {
    return (
      <>
        <PageHeader title="CRM settings" back={{ href: '/dashboard/crm', label: 'CRM' }} />
        <UpgradeGate
          feature="CRM and lead pipeline"
          body="Upgrade to Pro to set up your pipeline and bring in leads from WhatsApp and your website."
        />
      </>
    );
  }
  return <Settings />;
}

function Settings() {
  const settings = useApi<{ settings: CrmSettingsView }>('/app/crm/settings');
  const stages = useApi<{ stages: CrmStageView[] }>('/app/crm/stages');
  if (!settings.data || !stages.data) return <Loading />;
  return (
    <>
      <PageHeader
        title="CRM settings"
        back={{ href: '/dashboard/crm', label: 'CRM' }}
        description="Your pipeline's stages, who gets added on their own, and where new leads come in from."
      />
      <div className="space-y-6">
        <StagesEditor
          stages={stages.data.stages}
          onChange={(next) => stages.setData({ stages: next })}
        />
        <AutomationForm
          key={JSON.stringify(settings.data.settings)}
          settings={settings.data.settings}
          onSaved={(s) => settings.setData({ settings: s })}
        />
        <LeadSources
          settings={settings.data.settings}
          onChange={(s) => settings.setData({ settings: s })}
        />
      </div>
    </>
  );
}

// ── Stages ──────────────────────────────────────────────────────────────────

function StagesEditor({
  stages,
  onChange,
}: {
  stages: CrmStageView[];
  onChange: (stages: CrmStageView[]) => void;
}) {
  const { busy, run } = useAction();
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CrmStageKind>('OPEN');

  const save = (path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) =>
    run(async () => {
      const res = await api<{ stages: CrmStageView[] }>(path, { method, body });
      onChange(res.stages);
    });

  function moveStage(index: number, by: -1 | 1) {
    const ids = stages.map((s) => s.id);
    const j = index + by;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void save('/app/crm/stages/order', 'PUT', { ids });
  }

  function remove(stage: CrmStageView) {
    let moveTo = '';
    if (stage.leadCount) {
      const others = stages.filter((s) => s.id !== stage.id);
      const choice = window.prompt(
        `${stage.leadCount} lead${stage.leadCount > 1 ? 's are' : ' is'} in ${stage.name}. Type the name of the stage to move ${stage.leadCount > 1 ? 'them' : 'it'} to:\n${others.map((s) => s.name).join(', ')}`,
        others[0]?.name ?? '',
      );
      if (choice === null) return;
      const target = others.find((s) => s.name.toLowerCase() === choice.trim().toLowerCase());
      if (!target) return toast('No stage has that name', 'error');
      moveTo = target.id;
    } else if (!window.confirm(`Delete the ${stage.name} stage?`)) return;
    void save(
      `/app/crm/stages/${stage.id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`,
      'DELETE',
    );
  }

  return (
    <Section
      title="Pipeline stages"
      description="Rename, recolour and reorder your stages. Calls move leads forward through the built-in Contacted, Interested and Appointment stages, even after you rename them."
    >
      <ul className="divide-y divide-line/70">
        {stages.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <StageDot color={s.color} />
            <input
              className="input h-9 min-w-[140px] flex-1"
              aria-label="Stage name"
              value={names[s.id] ?? s.name}
              maxLength={40}
              onChange={(e) => setNames((n) => ({ ...n, [s.id]: e.target.value }))}
              onBlur={() => {
                const name = (names[s.id] ?? s.name).trim();
                if (name && name !== s.name)
                  void save(`/app/crm/stages/${s.id}`, 'PATCH', { name });
              }}
            />
            <select
              className="select h-9 w-auto"
              aria-label={`Colour for ${s.name}`}
              value={s.color}
              disabled={busy}
              onChange={(e) =>
                void save(`/app/crm/stages/${s.id}`, 'PATCH', {
                  color: e.target.value as CrmStageColor,
                })
              }
            >
              {CRM_STAGE_COLORS.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
            <select
              className="select h-9 w-auto"
              aria-label={`Kind of stage for ${s.name}`}
              value={s.kind}
              disabled={busy}
              onChange={(e) =>
                void save(`/app/crm/stages/${s.id}`, 'PATCH', {
                  kind: e.target.value as CrmStageKind,
                })
              }
            >
              {CRM_STAGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <span className="num w-16 text-right text-xs text-muted">
              {s.leadCount} lead{s.leadCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={`Move ${s.name} up`}
              disabled={busy || i === 0}
              onClick={() => moveStage(i, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={`Move ${s.name} down`}
              disabled={busy || i === stages.length - 1}
              onClick={() => moveStage(i, 1)}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon text-danger"
              aria-label={`Delete ${s.name}`}
              disabled={busy || stages.length <= 1}
              onClick={() => remove(s)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          void save('/app/crm/stages', 'POST', { name: newName.trim(), kind: newKind }).then(() =>
            setNewName(''),
          );
        }}
      >
        <input
          className="input h-9 min-w-[160px] flex-1 sm:max-w-xs"
          placeholder="New stage, e.g. Proposal sent"
          aria-label="New stage name"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="select h-9 w-auto"
          aria-label="Kind of the new stage"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as CrmStageKind)}
        >
          {CRM_STAGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn btn-secondary btn-sm"
          disabled={busy || !newName.trim()}
        >
          <Plus size={14} aria-hidden="true" /> Add stage
        </button>
      </form>
    </Section>
  );
}

// ── Automatic adds and new-lead calls ───────────────────────────────────────

function AutomationForm({
  settings,
  onSaved,
}: {
  settings: CrmSettingsView;
  onSaved: (s: CrmSettingsView) => void;
}) {
  const setup = useCallingSetup();
  const [form, setForm] = useState({
    autoAddOutcomes: settings.autoAddOutcomes,
    autoAddInbound: settings.autoAddInbound,
    instantCallEnabled: settings.instantCallEnabled,
    instantAgentId: settings.instantAgentId ?? '',
    instantNumberId: settings.instantNumberId ?? '',
    instantWindowStart: settings.instantWindowStart ?? '',
    instantWindowEnd: settings.instantWindowEnd ?? '',
    whatsappLeads: settings.whatsappLeads,
    whatsappReply: settings.whatsappReply,
  });
  const { busy, run } = useAction();

  // Pick the first agent and number when turning the new-lead call on.
  useEffect(() => {
    if (!form.instantCallEnabled) return;
    setForm((f) => ({
      ...f,
      instantAgentId: f.instantAgentId || setup.agents[0]?.id || '',
      instantNumberId: f.instantNumberId || setup.numbers[0]?.id || '',
    }));
  }, [form.instantCallEnabled, setup.agents, setup.numbers]);

  const toggleOutcome = (o: CallOutcome) =>
    setForm((f) => ({
      ...f,
      autoAddOutcomes: f.autoAddOutcomes.includes(o)
        ? f.autoAddOutcomes.filter((x) => x !== o)
        : [...f.autoAddOutcomes, o],
    }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const res = await api<{ settings: CrmSettingsView }>('/app/crm/settings', {
            method: 'PUT',
            body: {
              ...form,
              instantAgentId: form.instantAgentId || null,
              instantNumberId: form.instantNumberId || null,
            },
          });
          onSaved(res.settings);
        }, 'CRM settings saved');
      }}
    >
      <Section
        title="Added on their own"
        description="When a campaign call ends one of these ways, the person goes into your pipeline. Calls to people already in it always go on their timeline."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {CALL_OUTCOMES.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.autoAddOutcomes.includes(o)}
                onChange={() => toggleOutcome(o)}
              />
              {humanize(o)}
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={form.autoAddInbound}
            onChange={(e) => setForm((f) => ({ ...f, autoAddInbound: e.target.checked }))}
          />
          Also add people who call in and end the call one of these ways
        </label>
      </Section>

      <Section
        title="New leads"
        description="People who message your WhatsApp number or fill in a form on your website reached out to you first. Your agent can call them back while they're still interested."
      >
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.instantCallEnabled}
              onChange={(e) => setForm((f) => ({ ...f, instantCallEnabled: e.target.checked }))}
            />
            An agent calls each new lead straight away
          </label>
          {form.instantCallEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="instant-agent" label="Agent">
                <select
                  id="instant-agent"
                  className="select"
                  value={form.instantAgentId}
                  onChange={(e) => setForm((f) => ({ ...f, instantAgentId: e.target.value }))}
                >
                  <option value="">Choose an agent</option>
                  {setup.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="instant-number" label="Call from">
                <select
                  id="instant-number"
                  className="select"
                  value={form.instantNumberId}
                  onChange={(e) => setForm((f) => ({ ...f, instantNumberId: e.target.value }))}
                >
                  <option value="">Choose a number</option>
                  {setup.numbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.e164}
                      {n.friendlyName ? ` · ${n.friendlyName}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="instant-start"
                label="Calling hours start"
                optional
                help={`Your time zone: ${settings.timezone}. Leave both blank to call at any hour.`}
              >
                <input
                  id="instant-start"
                  type="time"
                  className="input"
                  value={form.instantWindowStart}
                  onChange={(e) => setForm((f) => ({ ...f, instantWindowStart: e.target.value }))}
                />
              </Field>
              <Field
                id="instant-end"
                label="Calling hours end"
                optional
                help="Leads that arrive outside these hours are called when they open."
              >
                <input
                  id="instant-end"
                  type="time"
                  className="input"
                  value={form.instantWindowEnd}
                  onChange={(e) => setForm((f) => ({ ...f, instantWindowEnd: e.target.value }))}
                />
              </Field>
            </div>
          )}

          <div className="border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.whatsappLeads}
                onChange={(e) => setForm((f) => ({ ...f, whatsappLeads: e.target.checked }))}
              />
              WhatsApp messages from new numbers become leads
            </label>
            {form.whatsappLeads && (
              <Field
                id="wa-reply"
                label="Reply on WhatsApp"
                optional
                className="mt-4"
                help="Sent once to each new lead. Leave blank to send nothing."
              >
                <textarea
                  id="wa-reply"
                  className="textarea min-h-[80px]"
                  maxLength={1000}
                  value={form.whatsappReply}
                  placeholder="Thanks for getting in touch! We'll give you a call in a moment."
                  onChange={(e) => setForm((f) => ({ ...f, whatsappReply: e.target.value }))}
                />
              </Field>
            )}
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

// ── Lead sources ────────────────────────────────────────────────────────────

function CopyField({
  id,
  label,
  value,
  help,
}: {
  id: string;
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <Field id={id} label={label} help={help}>
      <div className="flex gap-2">
        <input
          id={id}
          className="input num text-xs"
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn btn-secondary btn-icon shrink-0"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast('Copied');
            } catch {
              toast('Select the text and copy it', 'error');
            }
          }}
        >
          <Copy size={16} />
        </button>
      </div>
    </Field>
  );
}

function LeadSources({
  settings,
  onChange,
}: {
  settings: CrmSettingsView;
  onChange: (s: CrmSettingsView) => void;
}) {
  const [secret, setSecret] = useState('');
  const { busy, run } = useAction();
  const example = JSON.stringify(
    {
      phone: '+14155550123',
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Acme',
      message: 'I would like a quote',
    },
    null,
    2,
  );

  return (
    <Section
      title="Where new leads come in"
      description="Give these addresses to the tools that collect your leads. Keep them private: anyone with them can add leads."
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() =>
            window.confirm(
              'Make new addresses? The current ones stop working at once, so update them in WhatsApp, Zapier and your forms.',
            ) &&
            run(async () => {
              const res = await api<{ settings: CrmSettingsView }>(
                '/app/crm/settings/rotate-token',
                { method: 'POST' },
              );
              onChange(res.settings);
            }, 'New addresses made')
          }
        >
          <RefreshCw size={14} aria-hidden="true" /> New addresses
        </button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Website forms, Zapier and Make</h3>
          <CopyField
            id="lead-hook"
            label="Lead webhook"
            value={settings.leadWebhookUrl}
            help="POST a JSON or form body with at least a phone field. Use it from Zapier, Make, your form tool or your website's server; browsers on other sites can't post to it directly."
          />
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-brand-700">Example body</summary>
            <pre className="mt-2 overflow-x-auto rounded-sm bg-canvas p-3 text-xs">{example}</pre>
            <p className="mt-2 text-xs text-muted">
              Also accepted: first_name, last_name, notes and tags. Any other fields are kept on the
              lead and your agent can use them on the call.
            </p>
          </details>
        </div>

        <div className="space-y-3 border-t border-line pt-6">
          <h3 className="text-sm font-semibold">WhatsApp</h3>
          <p className="text-sm text-muted">
            Connect WhatsApp in Integrations first, so replies can be sent. Then point its incoming
            messages here.
          </p>
          <CopyField id="wa-hook" label="WhatsApp webhook" value={settings.whatsappWebhookUrl} />
          <CopyField id="wa-verify" label="Verify token (Meta)" value={settings.verifyToken} />
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-brand-700">
              Set up with Meta (WhatsApp Cloud API)
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
              <li>In Meta for Developers, open your app, then WhatsApp → Configuration.</li>
              <li>
                Under Webhook, choose Edit. Paste the WhatsApp webhook as the callback URL and the
                verify token above.
              </li>
              <li>Choose Verify and save, then subscribe to the messages field.</li>
              <li>
                Optional: paste the app secret below so every message is checked as really coming
                from Meta.
              </li>
            </ol>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-brand-700">
              Set up with Twilio
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
              <li>
                In the Twilio Console, open Messaging → Senders → WhatsApp senders and pick your
                number.
              </li>
              <li>
                Set &quot;A message comes in&quot; to the WhatsApp webhook above, using HTTP POST.
              </li>
              <li>Save. Messages are checked with your Twilio account&apos;s signature.</li>
            </ol>
          </details>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!secret.trim()) return;
              void run(async () => {
                const res = await api<{ settings: CrmSettingsView }>('/app/crm/settings', {
                  method: 'PUT',
                  body: { metaAppSecret: secret.trim() },
                });
                setSecret('');
                onChange(res.settings);
              }, 'App secret saved');
            }}
          >
            <Field
              id="meta-secret"
              label="Meta app secret"
              optional
              className="min-w-[220px] flex-1"
              help={
                settings.metaAppSecretSet
                  ? 'Saved. Messages from Meta are checked against it.'
                  : 'From App settings → Basic in Meta for Developers.'
              }
            >
              <input
                id="meta-secret"
                type="password"
                autoComplete="off"
                className="input"
                value={secret}
                placeholder={settings.metaAppSecretSet ? '••••••••' : ''}
                onChange={(e) => setSecret(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              className="btn btn-secondary mb-6"
              disabled={busy || !secret.trim()}
            >
              Save
            </button>
            {settings.metaAppSecretSet && (
              <button
                type="button"
                className="btn btn-ghost mb-6 text-danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const res = await api<{ settings: CrmSettingsView }>(
                      '/app/crm/settings/meta-app-secret',
                      { method: 'DELETE' },
                    );
                    onChange(res.settings);
                  }, 'App secret removed')
                }
              >
                Remove
              </button>
            )}
          </form>
        </div>
      </div>
    </Section>
  );
}
