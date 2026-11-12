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
export interface SignalWireCredentials {
  /** example.signalwire.com */
  spaceUrl: string;
  projectId: string;
  apiToken: string;
}
export interface TelnyxCredentials {
  apiKey: string;
  /** TeXML Application id, which is also its connection id. */
  applicationId: string;
}
export interface ExotelCredentials {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  /** api.in.exotel.com (Mumbai) or api.exotel.com (Singapore). */
  subdomain: string;
}
export interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  applicationId: string;
  /** PEM private key of the Vonage application, used to sign Voice API JWTs. */
  privateKey: string;
}
export interface BandwidthCredentials {
  accountId: string;
  /** OAuth 2.0 client credentials (Bandwidth retires Basic auth API users in Dec 2026). */
  clientId: string;
  clientSecret: string;
  applicationId: string;
}
export type TelephonyCredentials =
  | TwilioCredentials
  | PlivoCredentials
  | SuperPhoneCredentials
  | SignalWireCredentials
  | TelnyxCredentials
  | ExotelCredentials
  | VonageCredentials
  | BandwidthCredentials;

/** WebSocket audio protocols (voice/transports.ts). `none`: the carrier can't stream audio yet. */
export type MediaProtocol =
  'twilio' | 'plivo' | 'telnyx' | 'exotel' | 'vonage' | 'bandwidth' | 'none';

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
  /**
   * The media WebSocket for this call. Carriers that take the stream when the
   * call is placed (Exotel) use it instead of fetching a document from answerUrl.
   */
  streamUrl: string;
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
  readonly mediaProtocol: MediaProtocol;
  /**
   * How incoming calls reach Purple Voice:
   *   number   one voice URL per number, set by configureInbound (Twilio, Plivo, SignalWire)
   *   account  one URL for the whole account/application; calls are matched by the number dialled
   *   stream   the carrier opens our media WebSocket directly (Exotel's Voicebot applet)
   */
  readonly inboundRouting: 'number' | 'account' | 'stream';
  /**
   * True when the subscriber has to paste our URL into the carrier console
   * themselves (configureInbound can't set it through the API).
   */
  readonly manualInbound: boolean;

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
    /** Account-wide inbound and status URLs, for carriers routing a whole application. */
    accountInboundUrl: string;
    accountStatusUrl: string;
    /** Media WebSocket that answers this number directly (inboundRouting 'stream'). */
    inboundStreamUrl: string;
    existingAppId?: string | null;
  }): Promise<{ providerNumberId?: string; appId?: string }>;
  placeCall(input: PlaceCallInput): Promise<{ providerCallId: string }>;
  /** Ends a call, or cancels one that is still ringing. */
  hangup(providerCallId: string): Promise<void>;

  /** Connect the call's audio to our media WebSocket, after saying `intro` if given. */
  streamDocument(wsUrl: string, intro?: string): VoiceDocument;
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
