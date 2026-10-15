import type { TelephonyProvider } from '@prisma/client';

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}
export interface PlivoCredentials {
  authId: string;
  authToken: string;
}
export interface SuperPhoneCredentials {
  apiKey: string;
  sipDomain?: string;
}
export type TelephonyCredentials = TwilioCredentials | PlivoCredentials | SuperPhoneCredentials;

export interface ProviderNumber {
  /** Provider's id for the number (Twilio PN sid; Plivo uses the number itself). */
  id: string;
  e164: string;
  friendlyName?: string;
}

export interface PlaceCallInput {
  from: string;
  to: string;
  /** Called when the callee answers; must return the answer document. */
  answerUrl: string;
  /** Receives status / hangup callbacks. */
  statusUrl: string;
  ringTimeoutSec?: number;
}

/** An XML document returned to the provider from a voice webhook. */
export interface VoiceDocument {
  contentType: string;
  body: string;
}

/**
 * Everything Purple Voice needs from a carrier. Adding a provider means
 * implementing this interface and a MediaTransport (voice/transports.ts)
 * for its audio-stream protocol.
 */
export interface TelephonyAdapter {
  readonly provider: TelephonyProvider;
  /** Which WebSocket audio protocol the provider speaks. */
  readonly mediaProtocol: 'twilio' | 'plivo' | 'none';

  /** Checks the credentials; returns a label for the account. */
  verify(): Promise<{ label: string }>;
  listNumbers(): Promise<ProviderNumber[]>;
  /** Points the number's incoming calls at Purple Voice. */
  configureInbound(input: {
    e164: string;
    providerNumberId?: string | null;
    numberId: string;
    inboundUrl: string;
    statusUrl: string;
    existingAppId?: string | null;
  }): Promise<{ providerNumberId?: string; appId?: string }>;
  placeCall(input: PlaceCallInput): Promise<{ providerCallId: string }>;
  /** Moves the live call to a human. `documentUrl` serves transferDocument() if the provider needs a URL. */
  transferCall(providerCallId: string, to: string, documentUrl: string): Promise<void>;
  hangup(providerCallId: string): Promise<void>;

  /** Connect the call's audio to our media WebSocket. */
  streamDocument(wsUrl: string): VoiceDocument;
  transferDocument(to: string, callerId?: string): VoiceDocument;
  sayAndHangupDocument(message: string): VoiceDocument;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class TelephonyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}
