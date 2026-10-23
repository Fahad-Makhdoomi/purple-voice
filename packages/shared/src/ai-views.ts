import type { AiProvider, CredentialProvider, VoiceEngine } from './enums';
import type { ModelOption } from './models';

/**
 * JSON the API returns about the AI layer. Staff see providers, models and
 * keys; subscribers only see the voices they can pick and whether the AI is
 * ready. Dates are ISO strings.
 */

/** Where a vendor key comes from: staff added one for this subscriber, the platform's, or the server environment (Claude only). */
export type AiKeySource = 'workspace' | 'platform' | 'env';

export interface AiSettingsView {
  voiceEngine: VoiceEngine;
  llmProvider: AiProvider;
  model: string;
}

/** GET /api/app/ai — the subscriber's view. No vendor, model or key information. */
export interface WorkspaceAiView {
  /** The voices of the engine staff chose for this workspace. */
  voices: ModelOption[];
  defaultVoice: string;
  /** The languages an agent can speak with this AI. */
  languages: { id: string; label: string }[];
  /** Any voice id may be typed in, not only the ones listed. */
  customVoice: boolean;
  /** Every key the engine needs is available, so agents can take calls. */
  ready: boolean;
}

/** /api/admin/subscribers/:id/ai — staff manage one subscriber's AI layer. */
export interface AiAdminView {
  /** `workspace` when staff set this subscriber's AI, `platform` when it follows the default. */
  settings: AiSettingsView & { source: 'workspace' | 'platform' };
  platformDefault: AiSettingsView;
  /** The keys this subscriber's engine needs, and where each comes from (null: missing). */
  keys: { provider: CredentialProvider; source: AiKeySource | null }[];
  /** Keys staff added for this subscriber; they take precedence over the platform's. */
  workspaceKeys: {
    provider: CredentialProvider;
    label: string | null;
    last4: string;
    verifiedAt: string | null;
  }[];
  /** Every vendor; `configured` when the platform can supply a key for it. */
  platformKeys: { provider: CredentialProvider; configured: boolean }[];
  ready: boolean;
}

/** /api/admin/super/ai — platform-wide default AI layer and keys (super admin). */
export interface PlatformAiView {
  defaults: AiSettingsView;
  /** Every vendor; `configured` when a platform key is saved for it. */
  keys: {
    provider: CredentialProvider;
    configured: boolean;
    label: string | null;
    last4: string | null;
    verifiedAt: string | null;
    updatedAt: string | null;
  }[];
  /** ANTHROPIC_API_KEY is set on the server: Claude works even without a saved platform key. */
  envAnthropic: boolean;
}
