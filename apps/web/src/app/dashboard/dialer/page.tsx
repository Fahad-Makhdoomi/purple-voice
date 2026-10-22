'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Delete,
  Headphones,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  PhoneOutgoing,
  RotateCcw,
} from 'lucide-react';
import {
  DIALER_END_REASON_LABELS,
  DIALPAD_KEYS,
  TELEPHONY_PROVIDER_LABELS,
  normalizeDialNumber,
  type DialerCallView,
  type DialerEndReason,
  type DialpadKey,
  type TelephonyProvider,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { useWorkspace } from '@/lib/workspace';
import { BrowserCall, DialerSetupError, type CallPhase } from '@/lib/dialer';
import { formatDuration, formatRelative, humanize } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  EmptyState,
  ErrorNote,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
  Tabs,
  toast,
} from '@/components/ui';
import { Field } from '@/components/forms/Field';

interface NumberRow {
  id: string;
  e164: string;
  friendlyName: string | null;
  routingConfigured: boolean;
  telephonyAccount: { provider: TelephonyProvider; label: string | null };
}

interface AgentRow {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
}

type Phase = 'idle' | Exclude<CallPhase, 'ended'>;
/** You talk through the browser, or one of your agents makes the call. */
type Mode = 'me' | 'agent';

const ENDED = ['COMPLETED', 'TRANSFERRED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELED'];

const KEY_LETTERS: Partial<Record<DialpadKey, string>> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '0': '+',
};

/** Only these carriers stream call audio, so only their numbers can call from the browser. */
const canDial = (n: NumberRow) =>
  n.telephonyAccount.provider !== 'SUPERPHONE' && n.routingConfigured;

export default function DialerPage() {
  const { entitlements } = useWorkspace();
  const { me } = useSession();
  const numbers = useApi<{ numbers: NumberRow[] }>('/app/telephony/numbers');
  const recent = useApi<{ calls: DialerCallView[] }>('/app/dialer/calls');
  const agents = useApi<{ agents: AgentRow[] }>('/app/agents');
  const reloadRecent = recent.reload;

  const [mode, setMode] = useState<Mode>('me');
  const [agentId, setAgentId] = useState('');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [agentCallId, setAgentCallId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [fromId, setFromId] = useState('');
  const [dial, setDial] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<{ reason: DialerEndReason; seconds: number | null } | null>(
    null,
  );
  const [muted, setMuted] = useState(false);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tones, setTones] = useState('');
  const [micBlocked, setMicBlocked] = useState(false);
  const callRef = useRef<BrowserCall | null>(null);
  const answeredRef = useRef<number | null>(null);

  const eligible = useMemo(() => numbers.data?.numbers.filter(canDial) ?? [], [numbers.data]);
  const activeAgents = useMemo(
    () => agents.data?.agents.filter((a) => a.status === 'ACTIVE') ?? [],
    [agents.data],
  );
  const agentCall = recent.data?.calls.find((c) => c.id === agentCallId) ?? null;
  const agentCallLive = !!agentCallId && (!agentCall || !ENDED.includes(agentCall.status));
  const inCall = phase !== 'idle';

  // Default caller ID: the first number that can call.
  useEffect(() => {
    if (!eligible.length || eligible.some((n) => n.id === fromId)) return;
    setFromId(eligible[0].id);
  }, [eligible, fromId]);

  useEffect(() => {
    if (!activeAgents.length || activeAgents.some((a) => a.id === agentId)) return;
    setAgentId(activeAgents[0].id);
  }, [activeAgents, agentId]);

  // Links from the CRM: /dashboard/dialer?to=+1…&lead=…&mode=agent
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const to = q.get('to');
    if (to) setDial(to);
    if (q.get('lead')) setLeadId(q.get('lead'));
    if (q.get('mode') === 'agent') setMode('agent');
  }, []);

  // While an agent's call is live, keep its status fresh.
  useEffect(() => {
    if (!agentCallLive) return;
    const t = setInterval(() => void reloadRecent(), 3000);
    return () => clearInterval(t);
  }, [agentCallLive, reloadRecent]);

  // Warn up front when the browser has already blocked the microphone.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => setMicBlocked(status?.state === 'denied');
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((s) => {
        status = s;
        update();
        s.addEventListener('change', update);
      })
      .catch(() => undefined); // Firefox and older Safari can't query the microphone.
    return () => status?.removeEventListener('change', update);
  }, []);

  // The call timer.
  useEffect(() => {
    if (phase !== 'answered') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Leaving the page ends the call; ask before a reload or closing the tab does.
  useEffect(() => {
    if (!inCall) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [inCall]);
  useEffect(() => () => callRef.current?.hangup(), []);

  const pressKey = useCallback((key: DialpadKey) => {
    const call = callRef.current;
    if (call) {
      call.sendDigit(key);
      setTones((t) => (t + key).slice(-24));
    } else {
      // Numbers start with their country code: a first 0 types the +, any other digit gets one.
      setDial((d) => (d !== '' ? d + key : key === '0' ? '+' : /\d/.test(key) ? `+${key}` : key));
    }
  }, []);

  // During a call the keyboard's digits, * and # send tones too.
  useEffect(() => {
    if (phase !== 'answered') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest('input, select, textarea')) return;
      if ((DIALPAD_KEYS as readonly string[]).includes(e.key)) pressKey(e.key as DialpadKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, pressKey]);

  async function startCall() {
    if (callRef.current) return;
    const to = normalizeDialNumber(dial);
    if (!to) {
      setError('Enter the number with its country code, e.g. +1 415 555 0123.');
      return;
    }
    setError(null);
    setEnded(null);
    setMuted(false);
    setTones('');
    setAnsweredAt(null);
    answeredRef.current = null;

    const call: BrowserCall = new BrowserCall({
      onPhase: (next, reason) => {
        if (callRef.current !== call) return;
        if (next === 'answered') {
          answeredRef.current = Date.now();
          setAnsweredAt(answeredRef.current);
          setNow(Date.now());
        }
        if (next !== 'ended') return setPhase(next);
        callRef.current = null;
        setPhase('idle');
        setEnded({
          reason: reason ?? 'hangup',
          seconds: answeredRef.current
            ? Math.round((Date.now() - answeredRef.current) / 1000)
            : null,
        });
        // The API settles the call's status and duration a few seconds after it ends.
        setTimeout(() => void reloadRecent(), 1500);
        setTimeout(() => void reloadRecent(), 7000);
      },
    });
    callRef.current = call;
    setPhase('connecting');

    try {
      await call.prepare();
    } catch (err) {
      call.release();
      if (callRef.current === call) {
        callRef.current = null;
        setPhase('idle');
        setError(err instanceof DialerSetupError ? err.message : 'Could not start call audio.');
      }
      return;
    }
    if (call.isOver) return;

    try {
      const placed = await api<{ call: DialerCallView; socketPath: string }>('/app/dialer/calls', {
        body: { phoneNumberId: fromId, to },
      });
      call.connect(placed.call.id, placed.socketPath);
      void reloadRecent();
    } catch (err) {
      call.release();
      if (callRef.current === call) {
        callRef.current = null;
        setPhase('idle');
      }
      setError(err instanceof Error ? err.message : 'Could not place the call.');
    }
  }

  /** One of your agents rings the number and has the conversation; you can follow it on the call's page. */
  async function startAgentCall() {
    const to = normalizeDialNumber(dial);
    if (!to) {
      setError('Enter the number with its country code, e.g. +1 415 555 0123.');
      return;
    }
    setError(null);
    setEnded(null);
    setPlacing(true);
    try {
      const placed = await api<{ call: DialerCallView }>('/app/dialer/agent-calls', {
        body: { agentId, phoneNumberId: fromId, to, ...(leadId ? { leadId } : {}) },
      });
      setAgentCallId(placed.call.id);
      toast(`${activeAgents.find((a) => a.id === agentId)?.name ?? 'Your agent'} is calling ${to}`);
      await reloadRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the call.');
    } finally {
      setPlacing(false);
    }
  }

  async function endAgentCall() {
    if (!agentCallId) return;
    try {
      await api(`/app/dialer/calls/${agentCallId}/hangup`, { method: 'POST' });
      await reloadRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the call.');
    }
  }

  function toggleMute() {
    const next = !muted;
    callRef.current?.setMuted(next);
    setMuted(next);
  }

  if (!numbers.data) return <Loading />;

  const agentName = activeAgents.find((a) => a.id === agentId)?.name ?? 'The agent';
  const agentStatus = !agentCallId
    ? null
    : !agentCall || agentCall.status === 'QUEUED'
      ? 'Starting the call…'
      : agentCall.status === 'RINGING'
        ? 'Ringing…'
        : agentCall.status === 'IN_PROGRESS'
          ? `${agentCall.agent?.name ?? agentName} is talking with them`
          : agentCall.status === 'COMPLETED'
            ? 'Call ended'
            : humanize(agentCall.status);

  const statusText =
    phase === 'connecting'
      ? 'Calling…'
      : phase === 'ringing'
        ? 'Ringing…'
        : phase === 'answered'
          ? 'Connected'
          : ended
            ? DIALER_END_REASON_LABELS[ended.reason]
            : null;
  const timer =
    phase === 'answered' && answeredAt
      ? formatDuration(Math.max(0, Math.round((now - answeredAt) / 1000)))
      : ended?.seconds != null
        ? formatDuration(ended.seconds)
        : null;

  return (
    <>
      <PageHeader
        title="Dialer"
        description="Call anyone through one of your numbers. Talk yourself from your computer, or have one of your AI agents make the call. Minutes count toward your plan like any call."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <Section>
          {eligible.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="Connect a Twilio or Plivo number"
              body="Calls from the browser go out through a number on your Twilio or Plivo account."
              action={
                <Link href="/dashboard/numbers" className="btn btn-primary">
                  Phone numbers
                </Link>
              }
            />
          ) : (
            <div className="space-y-5">
              <div>
                <Tabs<Mode>
                  value={mode}
                  onChange={(m) => {
                    if (inCall || agentCallLive) return;
                    setMode(m);
                    setError(null);
                  }}
                  options={[
                    { value: 'me', label: "I'll talk" },
                    { value: 'agent', label: 'Agent calls' },
                  ]}
                />
                <p className="help">
                  {mode === 'me'
                    ? 'You talk through your microphone. No agent is on the line.'
                    : 'One of your AI agents rings the number and has the conversation, using its own instructions.'}
                </p>
              </div>

              {mode === 'agent' && (
                <Field
                  id="agent"
                  label="Agent"
                  help={
                    activeAgents.length === 0 ? (
                      <>
                        None of your agents is on.{' '}
                        <Link href="/dashboard/agents" className="font-semibold text-brand-700">
                          Turn one on
                        </Link>{' '}
                        to have it make calls.
                      </>
                    ) : undefined
                  }
                >
                  <select
                    id="agent"
                    className="select"
                    value={agentId}
                    disabled={agentCallLive || activeAgents.length === 0}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    {activeAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field id="from" label="Call from">
                <select
                  id="from"
                  className="select"
                  value={fromId}
                  disabled={inCall || agentCallLive}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  {eligible.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.e164} ·{' '}
                      {n.friendlyName ?? TELEPHONY_PROVIDER_LABELS[n.telephonyAccount.provider]}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <label htmlFor="dial" className="label">
                  Number to call
                </label>
                <div className="relative">
                  <input
                    id="dial"
                    className="input num h-14 pr-12 text-center text-xl font-semibold tracking-wide"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 415 555 0123"
                    value={dial}
                    disabled={inCall || agentCallLive}
                    aria-describedby="dial-help"
                    onChange={(e) => {
                      setDial(e.target.value.replace(/[^\d+\s()*#.-]/g, ''));
                      setLeadId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (mode === 'agent') {
                        if (!agentCallLive && !placing && agentId) void startAgentCall();
                      } else void startCall();
                    }}
                  />
                  {dial && !inCall && !agentCallLive && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon absolute right-1 top-1/2 -translate-y-1/2"
                      aria-label="Delete last digit"
                      onClick={() => setDial((d) => d.slice(0, -1))}
                    >
                      <Delete size={18} />
                    </button>
                  )}
                </div>
                <p id="dial-help" className="help">
                  Include the country code.
                </p>
              </div>

              <Keypad
                onPress={pressKey}
                disabled={
                  phase === 'connecting' ||
                  phase === 'ringing' ||
                  (mode === 'agent' && agentCallLive)
                }
              />

              <div className="text-center" aria-live="polite">
                {mode === 'agent' && agentStatus && (
                  <p className="text-sm font-semibold text-ink">
                    {agentStatus}
                    {agentCall && agentCall.durationSec > 0 && (
                      <span className="num ml-2 font-normal text-muted">
                        {formatDuration(agentCall.durationSec)}
                      </span>
                    )}
                    {agentCallId && (
                      <Link
                        href={`/dashboard/calls/${agentCallId}`}
                        className="ml-2 font-semibold text-brand-700 hover:text-brand-900"
                      >
                        Open call
                      </Link>
                    )}
                  </p>
                )}
                {mode === 'me' && statusText && (
                  <p className="text-sm font-semibold text-ink">
                    {statusText}
                    {timer && <span className="num ml-2 font-normal text-muted">{timer}</span>}
                  </p>
                )}
                {phase === 'answered' && tones && (
                  <p className="num mt-1 text-xs text-muted">Tones sent: {tones}</p>
                )}
              </div>

              {error && <ErrorNote message={error} />}
              {mode === 'me' && micBlocked && !error && (
                <ErrorNote message="Your browser is blocking the microphone for this site. Allow it from the icon in the address bar to make calls." />
              )}

              {!entitlements.active ? (
                <Link href="/dashboard/billing" className="btn btn-primary w-full">
                  Choose a plan to make calls
                </Link>
              ) : mode === 'agent' ? (
                agentCallLive ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-lg w-full"
                    onClick={() => void endAgentCall()}
                  >
                    <PhoneOff size={16} aria-hidden="true" /> End the agent&apos;s call
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg w-full"
                    onClick={() => void startAgentCall()}
                    disabled={!fromId || !dial || !agentId || placing}
                  >
                    <Bot size={16} aria-hidden="true" />{' '}
                    {placing ? 'Starting…' : `${agentName} calls now`}
                  </button>
                )
              ) : inCall ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    onClick={toggleMute}
                    disabled={phase !== 'answered'}
                    aria-pressed={muted}
                  >
                    {muted ? (
                      <MicOff size={16} aria-hidden="true" />
                    ) : (
                      <Mic size={16} aria-hidden="true" />
                    )}
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger flex-1"
                    onClick={() => callRef.current?.hangup()}
                  >
                    <PhoneOff size={16} aria-hidden="true" /> Hang up
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg w-full"
                  onClick={() => void startCall()}
                  disabled={!fromId || !dial}
                >
                  <Phone size={16} aria-hidden="true" /> Call
                </button>
              )}

              {mode === 'me' ? (
                <p className="flex items-start gap-2 text-xs text-muted">
                  <Headphones size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Use headphones: through speakers, the person you call can hear themselves echo.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-xs text-muted">
                  <Bot size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  The agent says who it is and why it&apos;s calling, as set in its instructions.
                  Only call people who expect to hear from you.
                </p>
              )}
            </div>
          )}
        </Section>

        <Section
          title="Recent calls"
          description="Calls made from the dialer in this workspace."
          actions={
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Refresh"
              onClick={() => void reloadRecent()}
            >
              <RotateCcw size={16} />
            </button>
          }
        >
          {!recent.data ? (
            <Loading />
          ) : recent.data.calls.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No calls from the dialer yet.</p>
          ) : (
            <ul className="-my-3 divide-y divide-line/70">
              {recent.data.calls.map((c) => {
                const number = eligible.find((n) => n.e164 === c.fromNumber);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <PhoneOutgoing size={16} className="text-brand-600" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/calls/${c.id}`}
                        className="num font-semibold hover:text-brand-700"
                      >
                        {c.toNumber}
                      </Link>
                      <p className="text-xs text-muted">
                        {c.agent
                          ? `${c.agent.name} (agent), for ${c.requestedBy?.id === me?.user.id ? 'you' : (c.requestedBy?.name ?? 'your team')}`
                          : c.placedBy?.id === me?.user.id
                            ? 'You'
                            : (c.placedBy?.name ?? 'Someone')}{' '}
                        · from <span className="num">{c.fromNumber}</span> ·{' '}
                        {formatRelative(c.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                    <span className="num w-12 text-right text-sm text-ink-soft">
                      {formatDuration(c.durationSec)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={inCall || agentCallLive}
                      onClick={() => {
                        setDial(c.toNumber);
                        if (number) setFromId(number.id);
                        if (c.agent) {
                          setMode('agent');
                          if (activeAgents.some((a) => a.id === c.agent!.id))
                            setAgentId(c.agent.id);
                        }
                        setError(null);
                      }}
                    >
                      Call again
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

function Keypad({ onPress, disabled }: { onPress: (key: DialpadKey) => void; disabled: boolean }) {
  return (
    <div
      className="mx-auto grid max-w-[280px] grid-cols-3 gap-2.5"
      role="group"
      aria-label="Keypad"
    >
      {DIALPAD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onPress(key)}
          className={cn(
            'flex h-14 flex-col items-center justify-center rounded-pill border border-line bg-surface transition',
            'hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-50',
          )}
        >
          <span className="num text-xl font-semibold leading-none">{key}</span>
          <span className="mt-0.5 h-3 text-[10px] font-semibold tracking-widest text-subtle">
            {KEY_LETTERS[key] ?? ''}
          </span>
        </button>
      ))}
    </div>
  );
}
