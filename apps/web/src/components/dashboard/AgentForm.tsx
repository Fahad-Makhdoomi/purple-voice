'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import {
  LANGUAGES,
  NOISE_FILTERS,
  NOISE_FILTER_LABELS,
  type AgentInput,
  type WorkspaceAiView,
} from '@pv/shared';
import { Field } from '@/components/forms/Field';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';

export type AgentDraft = AgentInput;

/** A new agent. Its voice is filled in with the workspace's default voice once it loads. */
export const EMPTY_AGENT: AgentDraft = {
  name: '',
  status: 'DRAFT',
  voice: '',
  language: 'en-US',
  systemPrompt: '',
  greeting: '',
  goal: '',
  knowledge: '',
  transferEnabled: false,
  transferNumber: null,
  appointmentBookingEnabled: false,
  calendarIntegrationId: null,
  appointmentDurationMin: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  maxCallDurationSec: 900,
  recordCalls: false,
  inboundGreeting: '',
  inboundInstructions: '',
  callbackGreeting: '',
  callbackInstructions: '',
  noiseFilter: 'STANDARD',
  emailEnabled: false,
  whatsappEnabled: false,
  shareInfo: '',
};

/**
 * The agent builder. Controlled; the parent page owns saving.
 *
 * Our team chooses the AI behind every agent (Admin → Subscribers → AI), so
 * subscribers only pick a voice from the ones it offers.
 */
export function AgentForm({
  value,
  onChange,
}: {
  value: AgentDraft;
  onChange: (v: AgentDraft) => void;
}) {
  const { entitlements } = useWorkspace();
  const ai = useApi<WorkspaceAiView>('/app/ai');
  const integrations = useApi<{
    integrations: Array<{ id: string; type: string; accountLabel: string | null }>;
  }>('/app/integrations');
  const calendars =
    integrations.data?.integrations.filter((i) => i.type === 'GOOGLE_CALENDAR') ?? [];
  const set = <K extends keyof AgentDraft>(key: K, v: AgentDraft[K]) =>
    onChange({ ...value, [key]: v });
  const [showKnowledge, setShowKnowledge] = useState(!!value.knowledge);
  // Set when the agent's saved voice is no longer offered (the team changed the AI voice).
  const [voiceReplaced, setVoiceReplaced] = useState(false);

  const voices = ai.data?.voices ?? [];
  // Use the default voice for a new agent, or when the saved one is no longer
  // offered. Only a new voice list or a changed voice needs this check.
  useEffect(() => {
    if (!ai.data || ai.data.voices.some((v) => v.id === value.voice)) return;
    if (value.voice) setVoiceReplaced(true);
    onChange({ ...value, voice: ai.data.defaultVoice });
  }, [ai.data, value.voice]);

  return (
    <div className="space-y-6">
      <section className="card card-pad space-y-5" aria-labelledby="basics">
        <h2 id="basics" className="font-semibold">
          Basics
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Agent name">
            <input
              id="name"
              className="input"
              required
              maxLength={80}
              value={value.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ava — Solar consultations"
            />
          </Field>
          <Field id="language" label="Language">
            <select
              id="language"
              className="select"
              value={value.language}
              onChange={(e) => set('language', e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="timezone"
            label="Business time zone"
            help="Used for booking slots and telling the time."
          >
            <input
              id="timezone"
              className="input"
              value={value.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              placeholder="America/New_York"
            />
          </Field>
          <Field id="maxDuration" label="Maximum call length (minutes)">
            <input
              id="maxDuration"
              type="number"
              min={1}
              max={60}
              className="input"
              value={Math.round(value.maxCallDurationSec / 60)}
              onChange={(e) =>
                set('maxCallDurationSec', Math.max(60, Math.min(3600, Number(e.target.value) * 60)))
              }
            />
          </Field>
        </div>
      </section>

      <section className="card card-pad space-y-5" aria-labelledby="voice">
        <h2 id="voice" className="font-semibold">
          Voice
        </h2>
        {ai.data && !ai.data.ready && (
          <p
            className="flex gap-3 rounded-sm bg-brand-50 px-4 py-3 text-sm text-brand-800"
            role="status"
          >
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Our team is finishing your AI voice setup. You can build the agent now; it can take
              calls once that&apos;s done.
            </span>
          </p>
        )}
        <div className="max-w-sm">
          <Field
            id="voice-select"
            label="Voice"
            error={
              ai.error && !ai.data ? 'Voices could not be loaded. Refresh to try again.' : null
            }
            help={
              voiceReplaced
                ? 'Our team switched your AI voice, so the voice this agent had isn’t available anymore. It now uses the one selected here; you can pick another.'
                : 'How your agent sounds on the phone.'
            }
          >
            <select
              id="voice-select"
              className="select"
              required
              disabled={!ai.data}
              value={ai.data ? value.voice : ''}
              onChange={(e) => {
                setVoiceReplaced(false);
                set('voice', e.target.value);
              }}
            >
              {!ai.data && (
                <option value="">{ai.error ? 'Voices unavailable' : 'Loading voices…'}</option>
              )}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.hint ? ` — ${v.hint}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="max-w-md">
          <Field
            id="noiseFilter"
            label="Background noise filter"
            help="Stops traffic, TVs and people in the background from interrupting the agent. Use Strong if your callers are often somewhere noisy."
          >
            <select
              id="noiseFilter"
              className="select"
              value={value.noiseFilter}
              onChange={(e) => set('noiseFilter', e.target.value as AgentDraft['noiseFilter'])}
            >
              {NOISE_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {NOISE_FILTER_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="card card-pad space-y-5" aria-labelledby="conversation">
        <div>
          <h2 id="conversation" className="font-semibold">
            Conversation
          </h2>
          <p className="mt-1 text-sm text-muted">
            Use <code className="rounded bg-brand-50 px-1 text-brand-800">{'{{first_name}}'}</code>,{' '}
            <code className="rounded bg-brand-50 px-1 text-brand-800">{'{{company}}'}</code> or any
            column from your contact CSV.
          </p>
        </div>
        <Field
          id="systemPrompt"
          label="Who the agent is and how it sells"
          help="Write it in second person. Include qualification questions and how to handle common objections."
        >
          <textarea
            id="systemPrompt"
            className="textarea min-h-[220px] font-[450]"
            required
            minLength={20}
            value={value.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)}
            placeholder="You are Ava, a friendly consultant for Northwind Solar. You call homeowners who requested a quote…"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="greeting"
            label="Opening line"
            help="Spoken as soon as the call connects."
            optional
          >
            <textarea
              id="greeting"
              className="textarea min-h-[90px]"
              maxLength={500}
              value={value.greeting}
              onChange={(e) => set('greeting', e.target.value)}
              placeholder="Hi {{first_name}}, this is Ava from Northwind Solar…"
            />
          </Field>
          <Field id="goal" label="Goal of the call" optional>
            <textarea
              id="goal"
              className="textarea min-h-[90px]"
              maxLength={1000}
              value={value.goal}
              onChange={(e) => set('goal', e.target.value)}
              placeholder="Book a free 30-minute consultation."
            />
          </Field>
        </div>
        {showKnowledge ? (
          <Field
            id="knowledge"
            label="Knowledge"
            help="Product facts, pricing, FAQs, objection handling. The agent refers to this, it doesn't recite it."
            optional
          >
            <textarea
              id="knowledge"
              className="textarea min-h-[160px]"
              maxLength={50000}
              value={value.knowledge}
              onChange={(e) => set('knowledge', e.target.value)}
            />
          </Field>
        ) : (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => setShowKnowledge(true)}
          >
            Add knowledge
          </button>
        )}
      </section>

      <section className="card card-pad space-y-5" aria-labelledby="incoming">
        <div>
          <h2 id="incoming" className="font-semibold">
            Incoming calls and call-backs
          </h2>
          <p className="mt-1 text-sm text-muted">
            The opening line and goal above are for calls the agent makes. Set how it should answer
            when someone rings in. Leave a box empty to use the agent&apos;s main instructions.
          </p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="font-semibold">When someone calls in</p>
          <p className="text-sm text-muted">
            Calls to a number where this agent answers (Phone numbers → Answers with), for example
            your customer care line.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field id="inboundGreeting" label="Answer with" optional>
              <textarea
                id="inboundGreeting"
                className="textarea min-h-[90px]"
                maxLength={500}
                value={value.inboundGreeting}
                onChange={(e) => set('inboundGreeting', e.target.value)}
                placeholder="Thanks for calling Northwind Solar customer care, this is Ava. How can I help?"
              />
            </Field>
            <Field id="inboundInstructions" label="How to handle these calls" optional>
              <textarea
                id="inboundInstructions"
                className="textarea min-h-[90px]"
                maxLength={10000}
                value={value.inboundInstructions}
                onChange={(e) => set('inboundInstructions', e.target.value)}
                placeholder="Act as customer care: find out what they need, answer from the knowledge, take a message or transfer billing questions to the team."
              />
            </Field>
          </div>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="font-semibold">When someone it called calls back</p>
          <p className="text-sm text-muted">
            The agent recognises the number, knows when it called them and what was said, and
            answers the call itself.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field id="callbackGreeting" label="Answer with" optional>
              <textarea
                id="callbackGreeting"
                className="textarea min-h-[90px]"
                maxLength={500}
                value={value.callbackGreeting}
                onChange={(e) => set('callbackGreeting', e.target.value)}
                placeholder="Hi {{first_name}}, thanks for calling back! This is Ava from Northwind Solar."
              />
            </Field>
            <Field id="callbackInstructions" label="How to handle call-backs" optional>
              <textarea
                id="callbackInstructions"
                className="textarea min-h-[90px]"
                maxLength={10000}
                value={value.callbackInstructions}
                onChange={(e) => set('callbackInstructions', e.target.value)}
                placeholder="Thank them for calling back, remind them why you called, and pick up where the last call left off."
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="card card-pad space-y-5" aria-labelledby="actions">
        <h2 id="actions" className="font-semibold">
          Actions during the call
        </h2>

        <div className="rounded-lg border border-line p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox mt-1"
              checked={value.appointmentBookingEnabled}
              disabled={!entitlements.features.appointmentBooking}
              onChange={(e) => set('appointmentBookingEnabled', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Book appointments</span>
              <span className="block text-sm text-muted">
                Checks availability and books meetings while on the call.
              </span>
            </span>
          </label>
          {value.appointmentBookingEnabled && (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field
                id="calendar"
                label="Calendar"
                help={
                  calendars.length
                    ? undefined
                    : 'Connect Google Calendar under Integrations, or bookings are kept in Purple Voice only.'
                }
              >
                <select
                  id="calendar"
                  className="select"
                  value={value.calendarIntegrationId ?? ''}
                  onChange={(e) => set('calendarIntegrationId', e.target.value || null)}
                >
                  <option value="">Purple Voice only</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      Google Calendar{c.accountLabel ? ` — ${c.accountLabel}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="duration" label="Meeting length (minutes)">
                <input
                  id="duration"
                  type="number"
                  min={10}
                  max={240}
                  step={5}
                  className="input"
                  value={value.appointmentDurationMin}
                  onChange={(e) => set('appointmentDurationMin', Number(e.target.value))}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox mt-1"
              checked={value.transferEnabled}
              disabled={!entitlements.features.callTransfer}
              onChange={(e) => set('transferEnabled', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Transfer to a human</span>
              <span className="block text-sm text-muted">
                Hands the live call to your team when the caller asks or is ready to buy.
              </span>
            </span>
          </label>
          {value.transferEnabled && (
            <div className="mt-4 max-w-sm">
              <Field id="transferNumber" label="Transfer to">
                <input
                  id="transferNumber"
                  type="tel"
                  className="input"
                  placeholder="+14155550123"
                  value={value.transferNumber ?? ''}
                  onChange={(e) => set('transferNumber', e.target.value.trim() || null)}
                />
              </Field>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
