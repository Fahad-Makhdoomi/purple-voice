'use client';

import { useState } from 'react';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LABELS,
  CREDENTIAL_PROVIDER_LABELS,
  VOICE_ENGINES,
  VOICE_ENGINE_DESCRIPTIONS,
  VOICE_ENGINE_LABELS,
  defaultModelForEngine,
  modelsForEngine,
  type AiCredentialInput,
  type AiProvider,
  type AiSettingsView,
  type CredentialProvider,
  type VoiceEngine,
} from '@pv/shared';
import { ErrorNote, Modal, toast } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { cn } from '@/lib/cn';

/**
 * Staff-only controls for the AI layer, shared by a subscriber's AI panel
 * (Admin → Subscribers → AI) and the platform default (Super admin → AI
 * providers). Subscribers never see vendors, models or keys.
 */

/** What each vendor key powers, shown wherever staff manage keys. */
export const KEY_USES: Record<CredentialProvider, string> = {
  OPENAI: 'OpenAI Realtime, and GPT models on the Cascaded engine.',
  ANTHROPIC: 'Claude models on the Cascaded engine.',
  GEMINI: 'Gemini Live, and Gemini models on the Cascaded engine.',
  DEEPGRAM:
    'Hearing and speaking on the Cascaded engine only. Gemini Live and Realtime don’t use it.',
  ELEVENLABS:
    'ElevenLabs Agents engine: the voice agent that answers the call. Needs “ElevenLabs Agents” read access.',
};

const MODEL_LABEL: Record<VoiceEngine, string> = {
  REALTIME: 'Realtime model',
  GEMINI_LIVE: 'Live model',
  CASCADED: 'Model',
  ELEVENLABS: 'ElevenLabs agent id',
};

const CUSTOM = '__custom__';

/** Just the settings, without the API's `source` or anything else riding along. */
export function pickAiSettings(v: AiSettingsView): AiSettingsView {
  return { voiceEngine: v.voiceEngine, llmProvider: v.llmProvider, model: v.model };
}

export function sameAiSettings(a: AiSettingsView, b: AiSettingsView) {
  return a.voiceEngine === b.voiceEngine && a.llmProvider === b.llmProvider && a.model === b.model;
}

/** "Gemini Live · gemini-3.8-live", with the LLM vendor for Cascaded. */
export function describeAiSettings(v: AiSettingsView) {
  return v.voiceEngine === 'CASCADED'
    ? `${VOICE_ENGINE_LABELS.CASCADED} · ${AI_PROVIDER_LABELS[v.llmProvider]} · ${v.model}`
    : `${VOICE_ENGINE_LABELS[v.voiceEngine]} · ${v.model}`;
}

/**
 * Engine, LLM vendor (Cascaded only) and model. Controlled; the parent owns
 * saving and must render it inside a <form> so the model id is validated.
 * Changing the engine or vendor resets the model to that engine's default.
 */
export function EngineModelFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  /** Keeps ids and the radio group name unique on the page. */
  idPrefix: string;
  value: AiSettingsView;
  onChange: (v: AiSettingsView) => void;
  disabled?: boolean;
}) {
  const options = modelsForEngine(value.voiceEngine, value.llmProvider);
  const known = options.find((m) => m.id === value.model);
  const [customMode, setCustomMode] = useState(false);
  // An ElevenLabs agent id is always typed: there is no catalogue to pick from.
  const isAgentId = value.voiceEngine === 'ELEVENLABS';
  const custom = customMode || !known;

  const setEngine = (voiceEngine: VoiceEngine) => {
    setCustomMode(false);
    onChange({
      ...value,
      voiceEngine,
      model: defaultModelForEngine(voiceEngine, value.llmProvider),
    });
  };
  const setProvider = (llmProvider: AiProvider) => {
    setCustomMode(false);
    onChange({
      ...value,
      llmProvider,
      model: defaultModelForEngine(value.voiceEngine, llmProvider),
    });
  };

  return (
    <div className="space-y-5">
      <fieldset disabled={disabled}>
        <legend className="label">Voice engine</legend>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {VOICE_ENGINES.map((engine) => {
            const checked = value.voiceEngine === engine;
            return (
              <label
                key={engine}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-4 transition focus-within:ring-4 focus-within:ring-brand-100',
                  checked
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-line bg-surface hover:border-brand-300',
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-engine`}
                  value={engine}
                  checked={checked}
                  onChange={() => setEngine(engine)}
                  className="mt-1 h-4 w-4 shrink-0 accent-brand"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{VOICE_ENGINE_LABELS[engine]}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {VOICE_ENGINE_DESCRIPTIONS[engine]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {value.voiceEngine === 'CASCADED' && (
          <Field
            id={`${idPrefix}-provider`}
            label="LLM vendor"
            help="Does the thinking on the call; Deepgram hears and speaks."
          >
            <select
              id={`${idPrefix}-provider`}
              className="select"
              value={value.llmProvider}
              disabled={disabled}
              onChange={(e) => setProvider(e.target.value as AiProvider)}
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {AI_PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!isAgentId && (
          <Field
            id={`${idPrefix}-model`}
            label={MODEL_LABEL[value.voiceEngine]}
            help={
              custom
                ? 'Type any model id the vendor supports below.'
                : (known?.hint ?? 'Pick a suggestion, or choose “Another model id” to type one.')
            }
          >
            <select
              id={`${idPrefix}-model`}
              className="select"
              value={custom ? CUSTOM : value.model}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value === CUSTOM) {
                  setCustomMode(true);
                } else {
                  setCustomMode(false);
                  onChange({ ...value, model: e.target.value });
                }
              }}
            >
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.hint ? ` — ${m.hint}` : ''}
                </option>
              ))}
              <option value={CUSTOM}>Another model id…</option>
            </select>
          </Field>
        )}
        {custom && (
          <Field
            id={`${idPrefix}-model-id`}
            label={isAgentId ? 'ElevenLabs agent id' : 'Model id'}
            help={
              isAgentId
                ? 'From ElevenLabs → Agents → your agent (agent_…). In its Security tab, allow overriding the system prompt, first message and language, and set audio to μ-law 8000 Hz for best quality.'
                : 'Exactly as the vendor names it: letters, digits and . : / - _ only.'
            }
            className={
              value.voiceEngine === 'CASCADED' || isAgentId
                ? 'sm:col-span-2 sm:max-w-md'
                : undefined
            }
          >
            <input
              id={`${idPrefix}-model-id`}
              className="input font-mono"
              required
              minLength={2}
              maxLength={100}
              pattern={'[\\w.:\\/\\-]+'}
              title="Letters, digits and . : / - _ only"
              spellCheck={false}
              autoComplete="off"
              disabled={disabled}
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value.trim() })}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

/**
 * Add or replace one vendor key. The API checks the key with the vendor
 * before saving; its message (e.g. "OpenAI rejected this key") is shown in
 * the dialog. The key is never echoed back.
 */
export function ApiKeyModal({
  provider,
  onClose,
  onSave,
  intro,
}: {
  provider: CredentialProvider | null;
  onClose: () => void;
  onSave: (input: AiCredentialInput) => Promise<unknown>;
  intro?: React.ReactNode;
}) {
  return (
    <Modal
      open={!!provider}
      onClose={onClose}
      title={provider ? `${CREDENTIAL_PROVIDER_LABELS[provider]} API key` : ''}
    >
      {/* Mounted only while open, so every opening starts with an empty form. */}
      {provider && (
        <ApiKeyForm provider={provider} onSave={onSave} onDone={onClose} intro={intro} />
      )}
    </Modal>
  );
}

function ApiKeyForm({
  provider,
  onSave,
  onDone,
  intro,
}: {
  provider: CredentialProvider;
  onSave: (input: AiCredentialInput) => Promise<unknown>;
  onDone: () => void;
  intro?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const label = String(f.get('label') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        provider,
        apiKey: String(f.get('apiKey') ?? '').trim(),
        ...(label ? { label } : {}),
      });
      toast('Key verified and saved');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the key');
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2 text-sm text-muted">
        {intro && <p>{intro}</p>}
        <p>
          We make one test request to {CREDENTIAL_PROVIDER_LABELS[provider]} before saving. The key
          is encrypted and never shown again.
        </p>
      </div>
      <Field id="ai-key-value" label="API key">
        <input
          id="ai-key-value"
          name="apiKey"
          type="password"
          className="input font-mono"
          required
          minLength={8}
          maxLength={500}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field
        id="ai-key-label"
        label="Label"
        help="For staff, e.g. which vendor account it bills."
        optional
      >
        <input id="ai-key-label" name="label" className="input" maxLength={80} autoComplete="off" />
      </Field>
      {error && <ErrorNote message={error} />}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Checking the key…' : 'Verify and save'}
      </button>
    </form>
  );
}
