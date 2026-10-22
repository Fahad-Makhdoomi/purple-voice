'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowRightLeft,
  Bot,
  CalendarCheck,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LEAD_SOURCE_LABELS,
  type CallOutcome,
  type CallStatus,
  type CrmActivityType,
  type CrmActivityView,
  type CrmLeadView,
  type CrmStageView,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import { formatDateTime, formatDuration, formatMoney, formatRelative } from '@/lib/format';
import { Loading, PageHeader, Section, StatusBadge, UpgradeGate, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { AgentCallModal, StageDot, ToCampaignModal } from '@/components/crm/CrmParts';

interface LeadDetail {
  lead: CrmLeadView & { fields: Record<string, unknown> | null };
  stages: CrmStageView[];
  activities: CrmActivityView[];
  calls: Array<{
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    status: CallStatus;
    outcome: CallOutcome | null;
    summary: string | null;
    durationSec: number;
    createdAt: string;
    agent: { id: string; name: string } | null;
    placedBy: { id: string; name: string } | null;
    campaign: { id: string; name: string } | null;
  }>;
  appointments: Array<{ id: string; startsAt: string; status: string; timezone: string }>;
}

const ACTIVITY_ICON: Record<CrmActivityType, LucideIcon> = {
  created: Plus,
  note: StickyNote,
  call: PhoneCall,
  stage: ArrowRightLeft,
  appointment: CalendarCheck,
  whatsapp: MessageCircle,
  campaign: Megaphone,
  edit: Pencil,
};

export default function LeadPage() {
  const allowed = useFeature('crm');
  if (!allowed) {
    return (
      <>
        <PageHeader title="CRM" back={{ href: '/dashboard/crm', label: 'CRM' }} />
        <UpgradeGate
          feature="CRM and lead pipeline"
          body="Upgrade to Pro to keep every lead, call and appointment in one pipeline."
        />
      </>
    );
  }
  return <Lead />;
}

function Lead() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, reload } = useApi<LeadDetail>(`/app/crm/leads/${id}`);
  const [editing, setEditing] = useState(false);
  const [agentCall, setAgentCall] = useState(false);
  const [toCampaign, setToCampaign] = useState(false);
  const [note, setNote] = useState('');
  const { busy, run } = useAction();

  if (!data) return <Loading />;
  const { lead, stages, activities, calls, appointments } = data;
  const stage = stages.find((s) => s.id === lead.stageId);
  const title = lead.name || lead.phone;
  const extra = Object.entries(lead.fields ?? {}).filter(
    ([, v]) => v !== null && v !== '' && typeof v !== 'object',
  );

  return (
    <>
      <PageHeader
        title={title}
        back={{ href: '/dashboard/crm', label: 'CRM' }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {stage && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <StageDot color={stage.color} /> {stage.name}
              </span>
            )}
            <span>·</span>
            <span className="num">{lead.phone}</span>
            {lead.company && <span>· {lead.company}</span>}
            <span>· {LEAD_SOURCE_LABELS[lead.source]}</span>
          </span>
        }
        actions={
          <>
            <Link
              href={`/dashboard/dialer?to=${encodeURIComponent(lead.phone)}&lead=${lead.id}`}
              className="btn btn-secondary"
            >
              <Phone size={16} aria-hidden="true" /> Call myself
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setAgentCall(true)}>
              <Bot size={16} aria-hidden="true" /> Agent calls now
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setToCampaign(true)}>
              <Megaphone size={16} aria-hidden="true" /> Add to campaign
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon text-danger"
              aria-label="Delete lead"
              disabled={busy}
              onClick={() =>
                window.confirm(`Delete ${title} and their timeline? Their calls stay in Calls.`) &&
                run(async () => {
                  await api(`/app/crm/leads/${lead.id}`, { method: 'DELETE' });
                  router.push('/dashboard/crm');
                }, 'Lead deleted')
              }
            >
              <Trash2 size={16} />
            </button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-6">
          <Section
            title="Details"
            actions={
              !editing && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
              )
            }
          >
            {editing ? (
              <EditLead
                lead={lead}
                onDone={async (saved) => {
                  setEditing(false);
                  if (saved) await reload();
                }}
              />
            ) : (
              <dl className="space-y-3 text-sm">
                <Row label="Stage">
                  <select
                    className="select h-9"
                    aria-label="Stage"
                    value={lead.stageId}
                    disabled={busy}
                    onChange={(e) =>
                      run(async () => {
                        await api(`/app/crm/leads/${lead.id}`, {
                          method: 'PATCH',
                          body: { stageId: e.target.value },
                        });
                        await reload();
                      }, 'Stage changed')
                    }
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Phone">
                  <span className="num">{lead.phone}</span>
                </Row>
                <Row label="Email">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-brand-700">
                      {lead.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Company">{lead.company || '—'}</Row>
                <Row label="Deal value">
                  <span className="num">
                    {lead.valueCents != null ? formatMoney(lead.valueCents) : '—'}
                  </span>
                </Row>
                <Row label="Tags">
                  {lead.tags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {lead.tags.map((t) => (
                        <span key={t} className="badge badge-neutral">
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                {lead.campaign && (
                  <Row label="Campaign">
                    <Link
                      href={`/dashboard/campaigns/${lead.campaign.id}`}
                      className="text-brand-700"
                    >
                      {lead.campaign.name}
                    </Link>
                  </Row>
                )}
                {lead.callDueAt && (
                  <Row label="Agent call">
                    <span className="badge badge-warning">
                      Due {formatRelative(lead.callDueAt)}
                    </span>
                  </Row>
                )}
                <Row label="Added">{formatDateTime(lead.createdAt)}</Row>
                {lead.notes && (
                  <div className="border-t border-line pt-3">
                    <dt className="text-xs font-semibold text-muted">Notes</dt>
                    <dd className="mt-1 whitespace-pre-line">{lead.notes}</dd>
                  </div>
                )}
                {extra.length > 0 && (
                  <div className="border-t border-line pt-3">
                    <dt className="text-xs font-semibold text-muted">From the form</dt>
                    <dd className="mt-1 space-y-1">
                      {extra.map(([k, v]) => (
                        <p key={k}>
                          <span className="text-muted">{k.replace(/_/g, ' ')}:</span> {String(v)}
                        </p>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Section>

          {appointments.length > 0 && (
            <Section title="Appointments">
              <ul className="space-y-2 text-sm">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span>{formatDateTime(a.startsAt)}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Timeline">
            <form
              className="mb-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                void run(async () => {
                  await api(`/app/crm/leads/${lead.id}/notes`, { body: { text: note.trim() } });
                  setNote('');
                  await reload();
                }, 'Note added');
              }}
            >
              <label htmlFor="note" className="sr-only">
                Add a note
              </label>
              <textarea
                id="note"
                className="textarea min-h-[72px]"
                placeholder="Add a note: what they said, what's next…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || !note.trim()}
                >
                  Add note
                </button>
              </div>
            </form>
            {activities.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ol className="space-y-4">
                {activities.map((a) => {
                  const Icon = ACTIVITY_ICON[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-line text-sm">{a.text}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {a.actor?.name ? `${a.actor.name} · ` : ''}
                          {formatRelative(a.createdAt)}
                          {a.callId && (
                            <>
                              {' · '}
                              <Link
                                href={`/dashboard/calls/${a.callId}`}
                                className="text-brand-700"
                              >
                                Open call
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <Section title="Calls" description="Every call to or from this number.">
            {calls.length === 0 ? (
              <p className="text-sm text-muted">No calls yet.</p>
            ) : (
              <ul className="-my-3 divide-y divide-line/70">
                {calls.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/dashboard/calls/${c.id}`}
                        className="font-semibold hover:text-brand-700"
                      >
                        {c.direction === 'INBOUND' ? 'They called' : 'Called them'}
                      </Link>
                      <span className="text-xs text-muted">
                        {c.agent ? c.agent.name : (c.placedBy?.name ?? 'Your team')}
                        {c.campaign ? ` · ${c.campaign.name}` : ''} · {formatRelative(c.createdAt)}
                      </span>
                      <span className="flex-1" />
                      {c.outcome ? (
                        <StatusBadge status={c.outcome} />
                      ) : (
                        <StatusBadge status={c.status} />
                      )}
                      <span className="num w-12 text-right text-sm text-ink-soft">
                        {formatDuration(c.durationSec)}
                      </span>
                    </div>
                    {c.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{c.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <AgentCallModal
        lead={lead}
        open={agentCall}
        onClose={() => setAgentCall(false)}
        onPlaced={() => setTimeout(() => void reload(), 2000)}
      />
      {toCampaign && (
        <ToCampaignModal open onClose={() => setToCampaign(false)} leadIds={[lead.id]} />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function EditLead({
  lead,
  onDone,
}: {
  lead: CrmLeadView;
  onDone: (saved: boolean) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    name: lead.name ?? '',
    phone: lead.phone,
    email: lead.email ?? '',
    company: lead.company ?? '',
    value: lead.valueCents != null ? String(lead.valueCents / 100) : '',
    tags: lead.tags.join(', '),
    notes: lead.notes,
  });
  const { busy, run } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const value = form.value.trim() ? Math.round(Number(form.value) * 100) : null;
          if (value !== null && !Number.isFinite(value))
            throw new Error('Enter the deal value as a number, e.g. 1500');
          await api(`/app/crm/leads/${lead.id}`, {
            method: 'PATCH',
            body: {
              name: form.name,
              phone: form.phone,
              email: form.email,
              company: form.company,
              notes: form.notes,
              valueCents: value,
              tags: form.tags
                .split(/[,;]/)
                .map((t) => t.trim())
                .filter(Boolean),
            },
          });
          await onDone(true);
        }, 'Saved');
      }}
    >
      <Field id="edit-name" label="Name">
        <input id="edit-name" className="input" value={form.name} onChange={set('name')} />
      </Field>
      <Field id="edit-phone" label="Phone">
        <input
          id="edit-phone"
          className="input num"
          inputMode="tel"
          value={form.phone}
          onChange={set('phone')}
        />
      </Field>
      <Field id="edit-email" label="Email">
        <input
          id="edit-email"
          type="email"
          className="input"
          value={form.email}
          onChange={set('email')}
        />
      </Field>
      <Field id="edit-company" label="Company">
        <input id="edit-company" className="input" value={form.company} onChange={set('company')} />
      </Field>
      <Field id="edit-value" label="Deal value (USD)">
        <input
          id="edit-value"
          className="input num"
          inputMode="decimal"
          value={form.value}
          onChange={set('value')}
        />
      </Field>
      <Field id="edit-tags" label="Tags" help="Separate with commas">
        <input id="edit-tags" className="input" value={form.tags} onChange={set('tags')} />
      </Field>
      <Field id="edit-notes" label="Notes" help="The agent sees these when it calls.">
        <textarea
          id="edit-notes"
          className="textarea min-h-[80px]"
          value={form.notes}
          onChange={set('notes')}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => void onDone(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
