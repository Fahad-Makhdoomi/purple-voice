import {
  escapeXml,
  TelephonyError,
  type ProviderNumber,
  type SuperPhoneCredentials,
  type TelephonyAdapter,
  type VoiceDocument,
} from './types';

/**
 * SuperPhone adapter — PENDING PROVIDER API ACCESS.
 *
 * SuperPhone's programmable-voice / audio-streaming API is not publicly
 * documented, so this adapter stores credentials and lets a workspace
 * register its SuperPhone numbers, but cannot yet place calls or receive
 * audio. Once the SuperPhone API reference is available, implement the
 * methods below and add a MediaTransport for its stream protocol in
 * voice/transports.ts; nothing else in the platform needs to change.
 *
 * Until then the dashboard tells the subscriber to forward the number to a
 * Twilio or Plivo number connected to the same workspace.
 */
export class SuperPhoneAdapter implements TelephonyAdapter {
  readonly provider = 'SUPERPHONE' as const;
  readonly mediaProtocol = 'none' as const;

  constructor(private readonly creds: SuperPhoneCredentials) {}

  private unavailable(): never {
    throw new TelephonyError(
      'SuperPhone call control is not available yet. Forward this number to a connected Twilio or Plivo number for now.',
      501,
    );
  }

  async verify() {
    if (!this.creds.apiKey) throw new TelephonyError('API key required', 400);
    return { label: this.creds.sipDomain ?? 'SuperPhone' };
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    return [];
  }

  async configureInbound(): Promise<{ providerNumberId?: string }> {
    // Numbers are registered without provider-side routing; see class comment.
    return {};
  }

  async placeCall(): Promise<{ providerCallId: string }> {
    this.unavailable();
  }

  async transferCall(): Promise<void> {
    this.unavailable();
  }

  async hangup(): Promise<void> {
    this.unavailable();
  }

  streamDocument(): VoiceDocument {
    this.unavailable();
  }

  transferDocument(to: string): VoiceDocument {
    return { contentType: 'text/xml', body: `<Response><Dial>${escapeXml(to)}</Dial></Response>` };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'text/xml',
      body: `<Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`,
    };
  }
}
