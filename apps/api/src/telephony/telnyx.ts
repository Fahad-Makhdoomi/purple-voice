import {
  escapeXml,
  TelephonyError,
  type PlaceCallInput,
  type ProviderNumber,
  type TelephonyAdapter,
  type TelnyxCredentials,
  type VoiceDocument,
} from './types';

const BASE = 'https://api.telnyx.com/v2';

/**
 * Telnyx through TeXML, its Twilio-compatible markup, on one TeXML
 * Application. Calls are placed on the application's connection
 * (POST /v2/texml/calls/{connection_id}), numbers are assigned to the
 * application, and the application's voice URL points at Purple Voice for
 * the whole account; incoming calls are matched by the number dialled.
 *
 * Audio: <Connect><Stream bidirectionalMode="rtp" bidirectionalCodec="PCMU">,
 * Telnyx's media-streaming protocol (TelnyxTransport). TeXML webhooks carry
 * Twilio's field names (CallSid, CallStatus, From, To).
 */
export class TelnyxAdapter implements TelephonyAdapter {
  readonly provider = 'TELNYX' as const;
  readonly mediaProtocol = 'telnyx' as const;
  readonly inboundRouting = 'account' as const;
  readonly manualInbound = false;

  constructor(private readonly creds: TelnyxCredentials) {}

  private async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, json?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.apiKey}`,
        Accept: 'application/json',
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as T & {
      errors?: Array<{ title?: string; detail?: string }>;
    };
    if (!res.ok) {
      const e = body.errors?.[0];
      throw new TelephonyError(e?.detail ?? e?.title ?? `Telnyx error ${res.status}`, res.status);
    }
    return body;
  }

  private app() {
    return this.request<{ data: { id: string; friendly_name?: string } }>(
      'GET',
      `/texml_applications/${encodeURIComponent(this.creds.applicationId)}`,
    );
  }

  async verify() {
    const { data } = await this.app();
    return { label: data.friendly_name || `TeXML app ${data.id}` };
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    const res = await this.request<{
      data: Array<{ id: string; phone_number: string; connection_name?: string | null }>;
    }>('GET', '/phone_numbers?page[size]=250');
    return res.data.map((n) => ({
      id: n.id,
      e164: n.phone_number,
      friendlyName: n.connection_name ?? undefined,
    }));
  }

  /**
   * Points the TeXML application at our account-wide inbound URL, then puts
   * the number on that application.
   */
  async configureInbound(input: {
    e164: string;
    providerNumberId?: string | null;
    accountInboundUrl: string;
    accountStatusUrl: string;
  }) {
    const { data: app } = await this.app();
    await this.request('PATCH', `/texml_applications/${encodeURIComponent(app.id)}`, {
      friendly_name: app.friendly_name || 'Purple Voice',
      voice_url: input.accountInboundUrl,
      voice_method: 'post',
      status_callback: input.accountStatusUrl,
      status_callback_method: 'post',
    });
    let id = input.providerNumberId;
    if (!id) {
      const found = await this.request<{ data: Array<{ id: string }> }>(
        'GET',
        `/phone_numbers?filter[phone_number]=${encodeURIComponent(input.e164)}`,
      );
      id = found.data[0]?.id;
      if (!id)
        throw new TelephonyError(`${input.e164} is not a number on this Telnyx account`, 404);
    }
    await this.request('PATCH', `/phone_numbers/${encodeURIComponent(id)}`, {
      connection_id: app.id,
    });
    return { providerNumberId: id };
  }

  async placeCall(input: PlaceCallInput) {
    const call = await this.request<{
      call_sid?: string;
      sid?: string;
      data?: { call_sid?: string; sid?: string };
    }>('POST', `/texml/calls/${encodeURIComponent(this.creds.applicationId)}`, {
      To: input.to,
      From: input.from,
      Url: input.answerUrl,
      Method: 'POST',
      StatusCallback: input.statusUrl,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'initiated ringing answered completed',
      Timeout: input.ringTimeoutSec ?? 30,
    });
    const id = call.call_sid ?? call.data?.call_sid ?? call.sid ?? call.data?.sid;
    if (!id) throw new TelephonyError('Telnyx did not return a call id');
    return { providerCallId: id };
  }

  /** A TeXML CallSid is the call's Call Control id ("v3:…"), which Call Control can hang up. */
  async hangup(providerCallId: string) {
    try {
      await this.request('POST', `/calls/${encodeURIComponent(providerCallId)}/actions/hangup`, {});
    } catch (err) {
      // Already over.
      if (!(err instanceof TelephonyError) || (err.status !== 404 && err.status !== 422)) throw err;
    }
  }

  streamDocument(wsUrl: string, intro?: string): VoiceDocument {
    const say = intro ? `<Say>${escapeXml(intro)}</Say>` : '';
    return {
      contentType: 'text/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Connect><Stream url="${escapeXml(wsUrl)}" bidirectionalMode="rtp" bidirectionalCodec="PCMU"/></Connect></Response>`,
    };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'text/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`,
    };
  }
}
