import {
  escapeXml,
  TelephonyError,
  type BandwidthCredentials,
  type PlaceCallInput,
  type ProviderNumber,
  type TelephonyAdapter,
  type VoiceDocument,
} from './types';

const VOICE = 'https://voice.bandwidth.com/api/v2/accounts';
const TOKEN_URL = 'https://api.bandwidth.com/api/v1/oauth2/token';

/** OAuth access tokens by client id, reused until shortly before they expire. */
const tokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * Bandwidth Programmable Voice (v2) with BXML.
 *
 * Calls are placed on the subscriber's Voice Application with OAuth 2.0
 * client credentials. Bandwidth links numbers to applications through
 * locations and SIP peers in its Dashboard, and the application's
 * "call initiated" URL is set there too, so inbound routing is a manual step:
 * the dashboard shows the two account-wide URLs to paste on the application.
 * Incoming calls are then matched by the number dialled.
 *
 * Audio: <StartStream mode="bidirectional"> (non-blocking, so followed by
 * <StopStream wait="true"/> to hold the call), JSON frames of base64 PCMU
 * (BandwidthTransport).
 */
export class BandwidthAdapter implements TelephonyAdapter {
  readonly provider = 'BANDWIDTH' as const;
  readonly mediaProtocol = 'bandwidth' as const;
  readonly inboundRouting = 'account' as const;
  readonly manualInbound = true;

  constructor(private readonly creds: BandwidthCredentials) {}

  private async token(): Promise<string> {
    const cached = tokens.get(this.creds.clientId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new TelephonyError(
        body.error_description ?? 'Bandwidth rejected the client ID or secret',
        res.status === 200 ? 400 : res.status,
      );
    }
    tokens.set(this.creds.clientId, {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    });
    return body.access_token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, json?: unknown) {
    const res = await fetch(`${VOICE}/${encodeURIComponent(this.creds.accountId)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        Accept: 'application/json',
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 200 && res.headers.get('content-length') === '0') return {} as T;
    const body = (await res.json().catch(() => ({}))) as T & { description?: string };
    if (!res.ok)
      throw new TelephonyError(body.description ?? `Bandwidth error ${res.status}`, res.status);
    return body;
  }

  async verify() {
    await this.token();
    // A read on the account proves the account id and the credentials belong together.
    await this.request('GET', '/calls?pageSize=1').catch((err) => {
      // An account without call listing still accepted the token for this account id.
      if (!(err instanceof TelephonyError) || err.status !== 404) throw err;
    });
    return { label: `Bandwidth ${this.creds.accountId}` };
  }

  /** Numbers live in Bandwidth's Dashboard API (XML); the subscriber types them in. */
  async listNumbers(): Promise<ProviderNumber[]> {
    return [];
  }

  /** Set by hand on the Voice Application (see the class comment). */
  async configureInbound(input: { e164: string }) {
    return { providerNumberId: input.e164 };
  }

  async placeCall(input: PlaceCallInput) {
    const call = await this.request<{ callId?: string }>('POST', '/calls', {
      from: input.from,
      to: input.to,
      applicationId: this.creds.applicationId,
      answerUrl: input.answerUrl,
      answerMethod: 'POST',
      disconnectUrl: input.statusUrl,
      disconnectMethod: 'POST',
      callTimeout: input.ringTimeoutSec ?? 30,
    });
    if (!call.callId) throw new TelephonyError('Bandwidth did not return a call id');
    return { providerCallId: call.callId };
  }

  async hangup(providerCallId: string) {
    try {
      await this.request('POST', `/calls/${encodeURIComponent(providerCallId)}`, {
        state: 'completed',
      });
    } catch (err) {
      // Already over.
      if (!(err instanceof TelephonyError) || (err.status !== 404 && err.status !== 409)) throw err;
    }
  }

  streamDocument(wsUrl: string, intro?: string): VoiceDocument {
    const speak = intro ? `<SpeakSentence>${escapeXml(intro)}</SpeakSentence>` : '';
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response>${speak}<StartStream name="purplevoice" mode="bidirectional" tracks="inbound" destination="${escapeXml(wsUrl)}"/><StopStream name="purplevoice" wait="true"/></Response>`,
    };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><SpeakSentence>${escapeXml(message)}</SpeakSentence><Hangup/></Response>`,
    };
  }
}

/**
 * Bandwidth callbacks are events, not statuses: "initiate"/"answer" while
 * the call is up, "disconnect" with a cause when it ends.
 */
export function bandwidthStatus(
  body: Record<string, unknown>,
): 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'CANCELED' | undefined {
  const event = String(body.eventType ?? '');
  if (event === 'answer') return 'IN_PROGRESS';
  if (event !== 'disconnect') return undefined;
  switch (String(body.cause ?? '')) {
    case 'hangup':
      return 'COMPLETED';
    case 'busy':
    case 'rejected':
      return 'BUSY';
    case 'timeout':
      return 'NO_ANSWER';
    case 'cancel':
      return 'CANCELED';
    default:
      return 'FAILED';
  }
}
