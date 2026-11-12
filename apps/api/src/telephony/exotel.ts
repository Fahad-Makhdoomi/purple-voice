import {
  escapeXml,
  TelephonyError,
  type ExotelCredentials,
  type PlaceCallInput,
  type ProviderNumber,
  type TelephonyAdapter,
  type VoiceDocument,
} from './types';

/**
 * Indian numbers often arrive from Exotel in national form ("09876543210")
 * or without the plus; everything else is assumed to carry its country code.
 */
export function exotelE164(raw: unknown): string {
  const s = String(raw ?? '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (s.startsWith('+')) return `+${d}`;
  if (d.length === 11 && d.startsWith('0')) return `+91${d.slice(1)}`;
  if (d.length === 10) return `+91${d}`;
  return `+${d}`;
}

/**
 * Exotel (India / Singapore) through AgentStream.
 *
 * Outbound: the Connect API dials the callee from an ExoPhone and, once
 * they answer, opens our media WebSocket itself (StreamUrl,
 * StreamType=bidirectional), so no answer document is fetched.
 *
 * Inbound: Exotel routes ExoPhones through App Bazaar flows, which its API
 * can't edit. The subscriber adds a Voicebot applet to the number's flow
 * with the per-number WebSocket URL the dashboard shows (manualInbound); the
 * call is created when that stream starts (media-server.ts).
 *
 * Exotel has no API to hang up a live call: closing the stream ends the
 * Voicebot applet (and a Connect API stream call), which is what ending a
 * session does anyway.
 *
 * Audio is 16-bit PCM at 8 kHz rather than μ-law; ExotelTransport converts.
 */
export class ExotelAdapter implements TelephonyAdapter {
  readonly provider = 'EXOTEL' as const;
  readonly mediaProtocol = 'exotel' as const;
  readonly inboundRouting = 'stream' as const;
  readonly manualInbound = true;

  constructor(private readonly creds: ExotelCredentials) {}

  private host() {
    // Only Exotel's own two clusters (validated on input too).
    return this.creds.subdomain === 'api.exotel.com' ? 'api.exotel.com' : 'api.in.exotel.com';
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    form?: Record<string, string | number | undefined>,
  ) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form ?? {})) if (v !== undefined) body.append(k, String(v));
    const res = await fetch(
      `https://${this.host()}${path.replace('{sid}', encodeURIComponent(this.creds.accountSid))}`,
      {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.creds.apiKey}:${this.creds.apiToken}`).toString('base64')}`,
          Accept: 'application/json',
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: form ? body : undefined,
        signal: AbortSignal.timeout(15000),
      },
    );
    const json = (await res.json().catch(() => ({}))) as T & {
      RestException?: { Message?: string };
      message?: string;
    };
    if (!res.ok) {
      throw new TelephonyError(
        json.RestException?.Message ?? json.message ?? `Exotel error ${res.status}`,
        res.status,
      );
    }
    return json;
  }

  async verify() {
    await this.listNumbers();
    return { label: `Exotel ${this.creds.accountSid}` };
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    const data = await this.request<{
      incoming_phone_numbers?: Array<{
        sid: string;
        phone_number?: string;
        friendly_name?: string;
      }>;
    }>('GET', '/v2_beta/Accounts/{sid}/IncomingPhoneNumbers?PageSize=100');
    return (data.incoming_phone_numbers ?? [])
      .filter((n) => n.phone_number)
      .map((n) => ({
        id: n.sid,
        e164: exotelE164(n.phone_number),
        friendlyName: n.friendly_name ?? undefined,
      }));
  }

  /** Nothing to set through the API: the dashboard shows the Voicebot URL to paste. */
  async configureInbound(input: { providerNumberId?: string | null }) {
    return { providerNumberId: input.providerNumberId ?? undefined };
  }

  async placeCall(input: PlaceCallInput) {
    const data = await this.request<{ Call?: { Sid?: string } }>(
      'POST',
      '/v1/Accounts/{sid}/Calls/connect.json',
      {
        // In Exotel's Connect API "From" is the person dialled first.
        From: input.to,
        CallerId: input.from,
        StreamUrl: input.streamUrl,
        StreamType: 'bidirectional',
        StatusCallback: input.statusUrl,
        'StatusCallbackEvents[0]': 'terminal',
        'StatusCallbackEvents[1]': 'answered',
        TimeOut: input.ringTimeoutSec ?? 30,
      },
    );
    const id = data.Call?.Sid;
    if (!id) throw new TelephonyError('Exotel did not return a call id');
    return { providerCallId: id };
  }

  async hangup(): Promise<void> {
    // See the class comment: the session closing its stream ends the call.
  }

  /** Never fetched: Exotel takes the stream URL when the call is placed or from the flow. */
  streamDocument(wsUrl: string): VoiceDocument {
    return { contentType: 'application/json', body: JSON.stringify({ url: wsUrl }) };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`,
    };
  }
}

/** Exotel call statuses (status callback "Status") to ours. */
export const EXOTEL_STATUS: Record<
  string,
  'QUEUED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'CANCELED'
> = {
  queued: 'QUEUED',
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  answered: 'IN_PROGRESS',
  completed: 'COMPLETED',
  busy: 'BUSY',
  failed: 'FAILED',
  'no-answer': 'NO_ANSWER',
  canceled: 'CANCELED',
};
