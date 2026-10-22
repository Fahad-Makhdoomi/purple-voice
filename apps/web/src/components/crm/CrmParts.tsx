'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, SquareKanban } from 'lucide-react';
import {
  CALL_OUTCOMES,
  type CallOutcome,
  type CrmLeadView,
  type CrmStageColor,
  type CrmStageView,
  type TelephonyProvider,
} from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';
import { Modal, toast, useAction } from '@/components/ui';
import { Field, FormError } from '@/components/forms/Field';

/** Stage colours as literal classes, so Tailwind keeps them. */
export const STAGE_DOT: Record<CrmStageColor, string> = {
  slate: 'bg-slate-400',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  brand: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
};

export const STAGE_TOP: Record<CrmStageColor, string> = {
  slate: 'border-t-slate-400',
  sky: 'border-t-sky-500',
  violet: 'border-t-violet-500',
  amber: 'border-t-amber-500',
  brand: 'border-t-brand-500',
  emerald: 'border-t-emerald-500',
  rose: 'border-t-rose-500',
};

export function StageDot({ color, className }: { color: CrmStageColor; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT[color], className)}
      aria-hidden="true"
    />
  );
}

interface AgentOption {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
}
interface NumberOption {
  id: string;
  e164: string;
  friendlyName: string | null;
  routingConfigured: boolean;
  telephonyAccount: { provider: TelephonyProvider };
}

/** Agents that are on, and numbers that can place AI calls. */
export function useCallingSetup() {
  const agents = useApi<{ agents: AgentOption[] }>('/app/agents');
  const numbers = useApi<{ numbers: NumberOption[] }>('/app/telephony/numbers');
  return {
    ready: !!agents.data && !!numbers.data,
    agents: agents.data?.agents.filter((a) => a.status === 'ACTIVE') ?? [],
    numbers:
      numbers.data?.numbers.filter(
        (n) => n.routingConfigured && n.telephonyAccount.provider !== 'SUPERPHONE',
      ) ?? [],
  };
}

function AgentAndNumber({
  setup,
  agentId,
  numberId,
  onAgent,
  onNumber,
}: {
  setup: ReturnType<typeof useCallingSetup>;
  agentId: string;
  numberId: string;
  onAgent: (id: string) => void;
  onNumber: (id: string) => void;
}) {
  return (
    <>
      <Field
        id="pick-agent"
        label="Agent"
        help={
          setup.ready && !setup.agents.length ? (
            <>
              None of your agents is on.{' '}
              <Link href="/dashboard/agents" className="font-semibold text-brand-700">
                Agents
              </Link>
            </>
          ) : undefined
        }
      >
        <select
          id="pick-agent"
          className="select"
          value={agentId}
          onChange={(e) => onAgent(e.target.value)}
        >
          {setup.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="pick-number"
        label="Call from"
        help={
          setup.ready && !setup.numbers.length ? (
            <>
              Connect a Twilio or Plivo number first.{' '}
              <Link href="/dashboard/numbers" className="font-semibold text-brand-700">
                Phone numbers
              </Link>
            </>
          ) : undefined
        }
      >
        <select
          id="pick-number"
          className="select"
          value={numberId}
          onChange={(e) => onNumber(e.target.value)}
        >
          {setup.numbers.map((n) => (
            <option key={n.id} value={n.id}>
              {n.e164}
              {n.friendlyName ? ` · ${n.friendlyName}` : ''}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/** Keeps a picked agent and number valid as the lists load. */
function usePicks(setup: ReturnType<typeof useCallingSetup>) {
  const [agentId, setAgentId] = useState('');
  const [numberId, setNumberId] = useState('');
  useEffect(() => {
    if (setup.agents.length && !setup.agents.some((a) => a.id === agentId))
      setAgentId(setup.agents[0].id);
  }, [setup.agents, agentId]);
  useEffect(() => {
    if (setup.numbers.length && !setup.numbers.some((n) => n.id === numberId))
      setNumberId(setup.numbers[0].id);
  }, [setup.numbers, numberId]);
  return { agentId, setAgentId, numberId, setNumberId };
}

/** One of your agents calls this lead now. */
export function AgentCallModal({
  lead,
  open,
  onClose,
  onPlaced,
}: {
  lead: Pick<CrmLeadView, 'id' | 'phone' | 'name'>;
  open: boolean;
  onClose: () => void;
  onPlaced?: () => void;
}) {
  const setup = useCallingSetup();
  const picks = usePicks(setup);
  const { busy, run } = useAction();
  const agent = setup.agents.find((a) => a.id === picks.agentId);

  return (
    <Modal open={open} onClose={onClose} title={`Agent call to ${lead.name || lead.phone}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          The agent rings <span className="num font-semibold text-ink">{lead.phone}</span> now. It
          knows the lead&apos;s name, company and notes, and the call shows on their timeline.
        </p>
        <AgentAndNumber
          setup={setup}
          agentId={picks.agentId}
          numberId={picks.numberId}
          onAgent={picks.setAgentId}
          onNumber={picks.setNumberId}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !picks.agentId || !picks.numberId}
            onClick={() =>
              run(
                async () => {
                  await api('/app/dialer/agent-calls', {
                    body: {
                      agentId: picks.agentId,
                      phoneNumberId: picks.numberId,
                      to: lead.phone,
                      leadId: lead.id,
                    },
                  });
                  onPlaced?.();
                  onClose();
                },
                `${agent?.name ?? 'Your agent'} is calling ${lead.name || lead.phone}`,
              )
            }
          >
            <Bot size={16} aria-hidden="true" /> {busy ? 'Starting…' : 'Call now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

/** Puts leads (picked ones, or a whole stage) into a campaign that exists or a new draft. */
export function ToCampaignModal({
  open,
  onClose,
  leadIds,
  stage,
}: {
  open: boolean;
  onClose: () => void;
  leadIds?: string[];
  stage?: Pick<CrmStageView, 'id' | 'name' | 'leadCount'>;
}) {
  const router = useRouter();
  const setup = useCallingSetup();
  const picks = usePicks(setup);
  const campaigns = useApi<{ campaigns: CampaignOption[] }>(open ? '/app/campaigns' : null);
  const open_ = campaigns.data?.campaigns.filter((c) =>
    ['DRAFT', 'PAUSED', 'RUNNING'].includes(c.status),
  );
  const [target, setTarget] = useState<'new' | 'existing'>('new');
  const [campaignId, setCampaignId] = useState('');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();
  const count = leadIds?.length ?? stage?.leadCount ?? 0;

  useEffect(() => {
    if (open_?.length && !open_.some((c) => c.id === campaignId)) setCampaignId(open_[0].id);
  }, [open_, campaignId]);

  function submit() {
    setError(null);
    return run(async () => {
      try {
        const res = await api<{ campaign: { id: string; name: string }; added: number }>(
          '/app/crm/leads/to-campaign',
          {
            body: {
              ...(leadIds ? { leadIds } : { stageId: stage!.id }),
              ...(target === 'existing'
                ? { campaignId }
                : {
                    newCampaign: {
                      name: name.trim(),
                      agentId: picks.agentId,
                      phoneNumberId: picks.numberId,
                      goal: goal.trim(),
                    },
                  }),
            },
          },
        );
        toast(`${res.added} added to ${res.campaign.name}`);
        onClose();
        router.push(`/dashboard/campaigns/${res.campaign.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add them to the campaign');
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Call these leads in a campaign">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {stage
            ? `Everyone in ${stage.name} (${count}).`
            : `${count} lead${count === 1 ? '' : 's'} selected.`}{' '}
          Numbers on your do-not-call list are skipped.
        </p>
        <div className="inline-flex gap-1.5" role="group" aria-label="Which campaign">
          <button
            type="button"
            className="chip"
            aria-pressed={target === 'new'}
            onClick={() => setTarget('new')}
          >
            New campaign
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={target === 'existing'}
            onClick={() => setTarget('existing')}
            disabled={!open_?.length}
          >
            Existing campaign
          </button>
        </div>

        {target === 'existing' ? (
          <Field id="to-campaign" label="Campaign">
            <select
              id="to-campaign"
              className="select"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              {open_?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status.toLowerCase()})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field id="campaign-name" label="Campaign name">
              <input
                id="campaign-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Follow up: interested leads"
              />
            </Field>
            <AgentAndNumber
              setup={setup}
              agentId={picks.agentId}
              numberId={picks.numberId}
              onAgent={picks.setAgentId}
              onNumber={picks.setNumberId}
            />
            <Field id="campaign-goal" label="Goal of the calls" optional>
              <textarea
                id="campaign-goal"
                className="textarea min-h-[80px]"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Book a demo with people who showed interest."
              />
            </Field>
            <p className="text-xs text-muted">
              The campaign is saved as a draft. You check its settings and confirm consent before it
              starts calling.
            </p>
          </>
        )}

        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy ||
              !count ||
              (target === 'existing'
                ? !campaignId
                : name.trim().length < 2 || !picks.agentId || !picks.numberId)
            }
            onClick={() => void submit()}
          >
            {busy ? 'Adding…' : target === 'existing' ? 'Add to campaign' : 'Create draft campaign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Adds one person to the pipeline by hand. */
export function AddLeadModal({
  open,
  onClose,
  stages,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  stages: CrmStageView[];
  onAdded: (lead: CrmLeadView) => void;
}) {
  const [form, setForm] = useState({
    phone: '',
    name: '',
    email: '',
    company: '',
    stageId: '',
    value: '',
    tags: '',
    notes: '',
  });
  const [error, setError] = useState<{ message: string; leadId?: string } | null>(null);
  const { busy, run } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    setError(null);
    return run(async () => {
      try {
        const value = form.value.trim() ? Math.round(Number(form.value) * 100) : null;
        if (value !== null && !Number.isFinite(value)) {
          setError({ message: 'Enter the deal value as a number, e.g. 1500' });
          return;
        }
        const { lead } = await api<{ lead: CrmLeadView }>('/app/crm/leads', {
          body: {
            phone: form.phone,
            name: form.name,
            email: form.email,
            company: form.company,
            notes: form.notes,
            valueCents: value,
            tags: form.tags
              .split(/[,;]/)
              .map((t) => t.trim())
              .filter(Boolean),
            ...(form.stageId ? { stageId: form.stageId } : {}),
          },
        });
        toast('Lead added');
        setForm({
          phone: '',
          name: '',
          email: '',
          company: '',
          stageId: '',
          value: '',
          tags: '',
          notes: '',
        });
        onAdded(lead);
      } catch (err) {
        const leadId =
          err instanceof ApiError && err.code === 'lead_exists'
            ? (err.details as { leadId?: string } | undefined)?.leadId
            : undefined;
        setError({
          message: err instanceof Error ? err.message : 'Could not add the lead',
          leadId,
        });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a lead">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="lead-phone" label="Phone" help="With the country code, e.g. +1 415 555 0123">
          <input
            id="lead-phone"
            className="input num"
            inputMode="tel"
            required
            value={form.phone}
            onChange={set('phone')}
          />
        </Field>
        <Field id="lead-name" label="Name" optional>
          <input id="lead-name" className="input" value={form.name} onChange={set('name')} />
        </Field>
        <Field id="lead-email" label="Email" optional>
          <input
            id="lead-email"
            type="email"
            className="input"
            value={form.email}
            onChange={set('email')}
          />
        </Field>
        <Field id="lead-company" label="Company" optional>
          <input
            id="lead-company"
            className="input"
            value={form.company}
            onChange={set('company')}
          />
        </Field>
        <Field id="lead-stage" label="Stage">
          <select id="lead-stage" className="select" value={form.stageId} onChange={set('stageId')}>
            <option value="">{stages[0]?.name ?? 'First stage'}</option>
            {stages.slice(1).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="lead-value" label="Deal value (USD)" optional>
          <input
            id="lead-value"
            className="input num"
            inputMode="decimal"
            value={form.value}
            onChange={set('value')}
            placeholder="1500"
          />
        </Field>
        <Field
          id="lead-tags"
          label="Tags"
          optional
          help="Separate with commas"
          className="sm:col-span-2"
        >
          <input id="lead-tags" className="input" value={form.tags} onChange={set('tags')} />
        </Field>
        <Field id="lead-notes" label="Notes" optional className="sm:col-span-2">
          <textarea
            id="lead-notes"
            className="textarea min-h-[80px]"
            value={form.notes}
            onChange={set('notes')}
          />
        </Field>
        {error && (
          <div className="sm:col-span-2">
            <FormError message={error.message} />
            {error.leadId && (
              <Link
                href={`/dashboard/crm/${error.leadId}`}
                className="mt-2 inline-block text-sm font-semibold text-brand-700"
              >
                Open that lead
              </Link>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !form.phone.trim()}>
            {busy ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const FROM_CAMPAIGN_DEFAULT: CallOutcome[] = [
  'INTERESTED',
  'APPOINTMENT_BOOKED',
  'CALLBACK_REQUESTED',
];

/** Campaign page: puts the contacts whose last call ended a chosen way into the pipeline. */
export function AddToCrmButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [outcomes, setOutcomes] = useState<CallOutcome[]>(FROM_CAMPAIGN_DEFAULT);
  const [stageId, setStageId] = useState('');
  const stages = useApi<{ stages: CrmStageView[] }>(open ? '/app/crm/stages' : null);
  const { busy, run } = useAction();
  const toggle = (o: CallOutcome) =>
    setOutcomes((list) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]));

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <SquareKanban size={14} aria-hidden="true" /> Add to CRM
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add contacts to the CRM">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Adds the contacts whose last call ended one of these ways. People already in the CRM
            stay where they are.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CALL_OUTCOMES.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={outcomes.includes(o)}
                  onChange={() => toggle(o)}
                />
                {humanize(o)}
              </label>
            ))}
          </div>
          <Field
            id="crm-stage"
            label="Stage"
            help="By default, each lands in the stage that fits its call."
          >
            <select
              id="crm-stage"
              className="select"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              <option value="">Match the call</option>
              {stages.data?.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !outcomes.length}
              onClick={() =>
                run(async () => {
                  const res = await api<{ added: number; alreadyInCrm: number }>(
                    '/app/crm/leads/from-campaign',
                    { body: { campaignId, outcomes, ...(stageId ? { stageId } : {}) } },
                  );
                  toast(
                    res.added || res.alreadyInCrm
                      ? `${res.added} added to the CRM${res.alreadyInCrm ? `, ${res.alreadyInCrm} already there` : ''}`
                      : 'No contacts ended their call that way yet',
                  );
                  setOpen(false);
                })
              }
            >
              {busy ? 'Adding…' : 'Add to CRM'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
