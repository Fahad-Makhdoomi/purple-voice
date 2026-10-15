'use client';

import { useState } from 'react';
import {
  CASCADED_VOICES,
  DEFAULT_LLM_MODEL,
  LANGUAGES,
  LLM_MODELS,
  REALTIME_MODELS,
  REALTIME_VOICES,
  type AgentInput,
  type AiProvider,
} from '@pv/shared';
import { Field } from '@/components/forms/Field';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { cn } from '@/lib/cn';

export type AgentDraft = AgentInput;

export const EMPTY_AGENT: AgentDraft = {
  name: '',
  status: 'DRAFT',
  voiceEngine: 'REALTIME',
  llmProvider: 'OPENAI',
  llmModel: 'gpt-realtime',
  voice: 'marin',
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
};

const PROVIDERS: Array<{ id: AiProvider; label: string }> = [
  { id: 'ANTHROPIC', label: 'Claude' },
  { id: 'OPENAI', label: 'OpenAI' },
  { id: 'GEMINI', label: 'Gemini' },
];

/** The agent builder. Controlled; the parent page owns saving. */
export function AgentForm({
  value,
  onChange,
}: {
  value: AgentDraft;
  onChange: (v: AgentDraft) => void;
}) {
  const { entitlements } = useWorkspace();
  const integrations = useApi<{
    integrations: Array<{ id: string; type: string; accountLabel: string | null }>;
  }>('/app/integrations');
  const calendars =
    integrations.data?.integrations.filter((i) => i.type === 'GOOGLE_CALENDAR') ?? [];
  const set = <K extends keyof AgentDraft>(key: K, v: AgentDraft[K]) =>
    onChange({ ...value, [key]: v });
  const [showKnowledge, setShowKnowledge] = useState(!!value.knowledge);

  const setEngine = (engine: AgentDraft['voiceEngine']) =>
    onChange(
      engine === 'REALTIME'
        ? {
            ...value,
            voiceEngine: engine,
            llmProvider: 'OPENAI',
            llmModel: 'gpt-realtime',
            voice: 'marin',
          }
        : {
            ...value,
            voiceEngine: engine,
            llmProvider: 'ANTHROPIC',
            llmModel: DEFAULT_LLM_MODEL.ANTHROPIC,
            voice: CASCADED_VOICES[0].id,
          },
    );

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
          Voice and model
        </h2>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Voice engine">
          {(
            [
              [
                'REALTIME',
                'Realtime',
                'OpenAI speech-to-speech. Fastest, most natural turn-taking.',
              ],
              [
                'CASCADED',
                'Cascaded',
                'Speech → Claude, Gemini or OpenAI → speech. Pick any model. Needs a Deepgram key.',
              ],
            ] as const
          ).map(([id, label, body]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value.voiceEngine === id}
              onClick={() => setEngine(id)}
              className={cn(
                'rounded-lg border p-4 text-left transition',
                value.voiceEngine === id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface hover:border-brand-300',
              )}
            >
              <p className="font-semibold">{label}</p>
              <p
                className={cn(
                  'mt-1 text-sm',
                  value.voiceEngine === id ? 'text-white/70' : 'text-muted',
                )}
              >
                {body}
              </p>
            </button>
          ))}
        </div>

        {value.voiceEngine === 'REALTIME' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="model" label="Realtime model">
              <select
                id="model"
                className="select"
                value={value.llmModel}
                onChange={(e) => set('llmModel', e.target.value)}
              >
                {REALTIME_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.hint ? ` — ${m.hint}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="voice-select" label="Voice">
              <select
                id="voice-select"
                className="select"
                value={value.voice}
                onChange={(e) => set('voice', e.target.value)}
              >
                {REALTIME_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="provider" label="AI provider">
              <select
                id="provider"
                className="select"
                value={value.llmProvider}
                onChange={(e) => {
                  const p = e.target.value as AiProvider;
                  onChange({ ...value, llmProvider: p, llmModel: DEFAULT_LLM_MODEL[p] });
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="model"
              label="Model"
              help={
                LLM_MODELS[value.llmProvider].find((m) => m.id === value.llmModel)?.hint ??
                'Any model id your key can use.'
              }
            >
              <input
                id="model"
                list="model-options"
                className="input"
                value={value.llmModel}
                onChange={(e) => set('llmModel', e.target.value)}
              />
              <datalist id="model-options">
                {LLM_MODELS[value.llmProvider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field id="voice-select" label="Voice">
              <select
                id="voice-select"
                className="select"
                value={value.voice}
                onChange={(e) => set('voice', e.target.value)}
              >
                {CASCADED_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
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
