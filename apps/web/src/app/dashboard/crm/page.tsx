'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Clock, Megaphone, Search, Settings, Trash2, UserPlus, Users } from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  type CrmLeadView,
  type CrmStageView,
  type LeadSource,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import { cn } from '@/lib/cn';
import { formatMoney, formatRelative } from '@/lib/format';
import {
  EmptyState,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
  Tabs,
  UpgradeGate,
  useAction,
} from '@/components/ui';
import { AddLeadModal, STAGE_TOP, StageDot, ToCampaignModal } from '@/components/crm/CrmParts';

interface Board {
  stages: CrmStageView[];
  leads: CrmLeadView[];
  total: number;
  limit: number;
  tags: string[];
}

type View = 'board' | 'list';

export default function CrmPage() {
  const allowed = useFeature('crm');
  if (!allowed) {
    return (
      <>
        <PageHeader title="CRM" />
        <UpgradeGate
          feature="CRM and lead pipeline"
          body="Keep every lead in one pipeline. Interested people and booked appointments from your campaigns land here on their own, new WhatsApp and website leads arrive with a call from your agent, and you can call any stage with a campaign."
        />
      </>
    );
  }
  return <Pipeline />;
}

function Pipeline() {
  const [view, setView] = useState<View>('board');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [tag, setTag] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toCampaign, setToCampaign] = useState<
    { leadIds: string[] } | { stage: CrmStageView } | null
  >(null);
  const { busy, run } = useAction();

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(source ? { source } : {}),
    ...(tag ? { tag } : {}),
  }).toString();
  const { data, reload, setData } = useApi<Board>(`/app/crm/leads${query ? `?${query}` : ''}`);
  const filtered = !!(q || source || tag);

  const byStage = useMemo(() => {
    const map = new Map<string, CrmLeadView[]>();
    for (const l of data?.leads ?? []) map.set(l.stageId, [...(map.get(l.stageId) ?? []), l]);
    return map;
  }, [data]);

  if (!data) return <Loading />;
  const { stages, leads } = data;

  /** Moves leads, showing it at once and putting it back if the server says no. */
  function move(leadIds: string[], stageId: string) {
    const before = data;
    setData((d) =>
      d ? { ...d, leads: d.leads.map((l) => (leadIds.includes(l.id) ? { ...l, stageId } : l)) } : d,
    );
    return run(async () => {
      try {
        await api('/app/crm/leads/move', { body: { leadIds, stageId } });
        await reload();
      } catch (err) {
        setData(before);
        throw err;
      }
    });
  }

  const selectedIds = [...selected];
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title="CRM"
        description="Your lead pipeline. Good campaign calls, booked appointments and new WhatsApp or website leads are added on their own."
        actions={
          <>
            <Link href="/dashboard/crm/settings" className="btn btn-secondary">
              <Settings size={16} aria-hidden="true" /> Settings
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <UserPlus size={16} aria-hidden="true" /> Add lead
            </button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'List' },
          ]}
        />
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <input
            className="input h-9 pl-9"
            placeholder="Search name, phone, email, company"
            aria-label="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select h-9 w-auto"
          aria-label="Where leads came from"
          value={source}
          onChange={(e) => setSource(e.target.value as LeadSource | '')}
        >
          <option value="">Any source</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {LEAD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        {data.tags.length > 0 && (
          <select
            className="select h-9 w-auto"
            aria-label="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Any tag</option>
            {data.tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {data.total === 0 && !filtered ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          body="Leads arrive when a campaign call ends interested or with an appointment, when someone messages your WhatsApp number, or from your website through the lead webhook. You can also add them by hand."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                <UserPlus size={16} aria-hidden="true" /> Add lead
              </button>
              <Link href="/dashboard/crm/settings" className="btn btn-secondary">
                Connect lead sources
              </Link>
            </div>
          }
        />
      ) : view === 'board' ? (
        <BoardView
          stages={stages}
          byStage={byStage}
          onMove={(id, stageId) => void move([id], stageId)}
          onCallStage={(stage) => setToCampaign({ stage })}
        />
      ) : (
        <Section>
          {selected.size > 0 && (
            <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2 rounded-sm bg-brand-50 px-3 py-2 text-sm">
              <span className="font-semibold">{selected.size} selected</span>
              <select
                className="select h-8 w-auto text-xs"
                aria-label="Move selected leads to"
                value=""
                disabled={busy}
                onChange={async (e) => {
                  if (!e.target.value) return;
                  await move(selectedIds, e.target.value);
                  setSelected(new Set());
                }}
              >
                <option value="">Move to…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setToCampaign({ leadIds: selectedIds })}
              >
                <Megaphone size={14} aria-hidden="true" /> Add to campaign
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-danger"
                disabled={busy}
                onClick={() =>
                  window.confirm(
                    `Delete ${selected.size} lead${selected.size === 1 ? '' : 's'} and their timelines? Their calls stay in Calls.`,
                  ) &&
                  run(async () => {
                    await api('/app/crm/leads/delete', { body: { leadIds: selectedIds } });
                    setSelected(new Set());
                    await reload();
                  }, 'Deleted')
                }
              >
                <Trash2 size={14} aria-hidden="true" /> Delete
              </button>
            </div>
          )}
          <ListView
            leads={leads}
            stages={stages}
            selected={selected}
            onToggle={toggle}
            onToggleAll={(on) => setSelected(on ? new Set(leads.map((l) => l.id)) : new Set())}
            onMove={(id, stageId) => void move([id], stageId)}
          />
        </Section>
      )}

      {data.total > data.leads.length && (
        <p className="mt-4 text-center text-sm text-muted">
          Showing the {data.leads.length} most recently active of {data.total} leads. Search or
          filter to find the rest.
        </p>
      )}

      <AddLeadModal
        open={adding}
        onClose={() => setAdding(false)}
        stages={stages}
        onAdded={() => {
          setAdding(false);
          void reload();
        }}
      />
      {toCampaign && (
        <ToCampaignModal
          open
          onClose={() => setToCampaign(null)}
          {...('stage' in toCampaign
            ? { stage: toCampaign.stage }
            : { leadIds: toCampaign.leadIds })}
        />
      )}
    </>
  );
}

function LeadMeta({ lead }: { lead: CrmLeadView }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="badge badge-neutral">{LEAD_SOURCE_LABELS[lead.source]}</span>
      {lead.lastOutcome && <StatusBadge status={lead.lastOutcome} />}
      {lead.callDueAt && (
        <span className="badge badge-warning">
          <Clock size={11} aria-hidden="true" /> Agent call {formatRelative(lead.callDueAt)}
        </span>
      )}
    </div>
  );
}

function BoardView({
  stages,
  byStage,
  onMove,
  onCallStage,
}: {
  stages: CrmStageView[];
  byStage: Map<string, CrmLeadView[]>;
  onMove: (leadId: string, stageId: string) => void;
  onCallStage: (stage: CrmStageView) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-4">
        {stages.map((stage) => {
          const cards = byStage.get(stage.id) ?? [];
          return (
            <section
              key={stage.id}
              aria-label={stage.name}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border border-t-4 border-line bg-canvas/60',
                STAGE_TOP[stage.color],
                over === stage.id && 'ring-2 ring-brand-300',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((o) => (o === stage.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) onMove(id, stage.id);
              }}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <StageDot color={stage.color} />
                <h2 className="flex-1 truncate text-sm font-semibold">{stage.name}</h2>
                <span className="num text-xs text-muted">{stage.leadCount}</span>
              </header>
              <div className="flex items-center justify-between px-3 pb-2 text-xs text-muted">
                <span className="num">{stage.valueCents ? formatMoney(stage.valueCents) : ''}</span>
                {stage.kind === 'OPEN' && stage.leadCount > 0 && (
                  <button
                    type="button"
                    className="font-semibold text-brand-700 hover:text-brand-900"
                    onClick={() => onCallStage(stage)}
                  >
                    Call this stage
                  </button>
                )}
              </div>
              <ul className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3">
                {cards.map((lead) => (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', lead.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="cursor-grab rounded-md border border-line bg-surface p-3 shadow-sm transition hover:border-brand-300 active:cursor-grabbing"
                  >
                    <Link
                      href={`/dashboard/crm/${lead.id}`}
                      className="block font-semibold leading-snug hover:text-brand-700"
                    >
                      {lead.name || <span className="num">{lead.phone}</span>}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {lead.name && <span className="num">{lead.phone}</span>}
                      {lead.name && lead.company && ' · '}
                      {lead.company}
                    </p>
                    <LeadMeta lead={lead} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-subtle">
                        {formatRelative(lead.lastActivityAt)}
                      </span>
                      <select
                        className="select h-7 w-auto max-w-[120px] px-2 text-[11px]"
                        aria-label={`Stage for ${lead.name || lead.phone}`}
                        value={lead.stageId}
                        onChange={(e) => onMove(lead.id, e.target.value)}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
                {cards.length === 0 && (
                  <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-subtle">
                    Drop leads here
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ListView({
  leads,
  stages,
  selected,
  onToggle,
  onToggleAll,
  onMove,
}: {
  leads: CrmLeadView[];
  stages: CrmStageView[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (on: boolean) => void;
  onMove: (leadId: string, stageId: string) => void;
}) {
  if (!leads.length)
    return <p className="py-8 text-center text-sm text-muted">No leads match these filters.</p>;
  const all = leads.every((l) => selected.has(l.id));
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="table min-w-[760px]">
        <thead>
          <tr>
            <th className="w-10 pl-5 sm:pl-6">
              <input
                type="checkbox"
                className="checkbox"
                aria-label="Select all"
                checked={all}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th>Lead</th>
            <th>Stage</th>
            <th>Source</th>
            <th>Last call</th>
            <th className="text-right">Value</th>
            <th className="pr-5 text-right sm:pr-6">Activity</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td className="pl-5 sm:pl-6">
                <input
                  type="checkbox"
                  className="checkbox"
                  aria-label={`Select ${lead.name || lead.phone}`}
                  checked={selected.has(lead.id)}
                  onChange={() => onToggle(lead.id)}
                />
              </td>
              <td>
                <Link
                  href={`/dashboard/crm/${lead.id}`}
                  className="font-semibold hover:text-brand-700"
                >
                  {lead.name || <span className="num">{lead.phone}</span>}
                </Link>
                <p className="text-xs text-muted">
                  {lead.name && <span className="num">{lead.phone}</span>}
                  {lead.name && lead.company && ' · '}
                  {lead.company}
                </p>
              </td>
              <td>
                <select
                  className="select h-8 w-auto text-xs"
                  aria-label={`Stage for ${lead.name || lead.phone}`}
                  value={lead.stageId}
                  onChange={(e) => onMove(lead.id, e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="text-xs">{LEAD_SOURCE_LABELS[lead.source]}</td>
              <td>
                {lead.lastOutcome ? (
                  <StatusBadge status={lead.lastOutcome} />
                ) : (
                  <span className="text-xs text-subtle">
                    {lead.lastCallAt ? 'No outcome' : 'Not called'}
                  </span>
                )}
              </td>
              <td className="num text-right">
                {lead.valueCents != null ? formatMoney(lead.valueCents) : '—'}
              </td>
              <td className="pr-5 text-right text-xs text-muted sm:pr-6">
                {formatRelative(lead.lastActivityAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
