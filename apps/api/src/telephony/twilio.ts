import {
  escapeXml,
  TelephonyError,
  type PlaceCallInput,
  type ProviderNumber,
  type TelephonyAdapter,
  type TwilioCredentials,
  type VoiceDocument,
} from './types';

const BASE = 'https://api.twilio.com/2010-04-01';

/** Twilio Programmable Voice + Media Streams. */
export class TwilioAdapter implements TelephonyAdapter {
  readonly provider = 'TWILIO' as const;
  readonly mediaProtocol = 'twilio' as const;

  constructor(private readonly creds: TwilioCredentials) {}

  private async request<T>(method: 'GET' | 'POST', path: string, form?: Record<string, string | string[]>) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form ?? {})) {
      for (const item of Array.isArray(v) ? v : [v]) body.append(k, item);
    }
    const res = await fetch(`${BASE}/Accounts/${this.creds.accountSid}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.creds.accountSid}:${this.creds.authToken}`).toString('base64')}`,
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? body : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new TelephonyError(json.message ?? `Twilio error ${res.status}`, res.status);
    return json;
  }

  async verify() {
    const acct = await this.request<{ friendly_name: string }>('GET', '.json');
    return { label: acct.friendly_name };
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    const data = await this.request<{
      incoming_phone_numbers: Array<{ sid: string; phone_number: string; friendly_name: string }>;
    }>('GET', '/IncomingPhoneNumbers.json?PageSize=200');
    return data.incoming_phone_numbers.map((n) => ({
      id: n.sid,
      e164: n.phone_number,
      friendlyName: n.friendly_name,
    }));
  }

  async configureInbound(input: {
    e164: string;
    providerNumberId?: string | null;
    inboundUrl: string;
    statusUrl: string;
  }) {
    let sid = input.providerNumberId;
    if (!sid) {
      const found = await this.request<{ incoming_phone_numbers: Array<{ sid: string }> }>(
        'GET',
        `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(input.e164)}`,
      );
      sid = found.incoming_phone_numbers[0]?.sid;
      if (!sid) throw new TelephonyError(`${input.e164} is not a number on this Twilio account`, 404);
    }
    await this.request('POST', `/IncomingPhoneNumbers/${sid}.json`, {
      VoiceUrl: input.inboundUrl,
      VoiceMethod: 'POST',
      StatusCallback: input.statusUrl,
      StatusCallbackMethod: 'POST',
    });
    return { providerNumberId: sid };
  }

  async placeCall(input: PlaceCallInput) {
    const call = await this.request<{ sid: string }>('POST', '/Calls.json', {
      To: input.to,
      From: input.from,
      Url: input.answerUrl,
      Method: 'POST',
      StatusCallback: input.statusUrl,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      Timeout: String(input.ringTimeoutSec ?? 30),
    });
    return { providerCallId: call.sid };
  }

  async transferCall(providerCallId: string, to: string) {
    await this.request('POST', `/Calls/${providerCallId}.json`, { Twiml: this.transferDocument(to).body });
  }

  async hangup(providerCallId: string) {
    await this.request('POST', `/Calls/${providerCallId}.json`, { Status: 'completed' });
  }

  /** Twilio ignores query strings on stream URLs, so call id and signature travel in the path. */
  streamDocument(wsUrl: string): VoiceDocument {
    return {
      contentType: 'text/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(wsUrl)}"/></Connect></Response>`,
    };
  }

  transferDocument(to: string, callerId?: string): VoiceDocument {
    const attr = callerId ? ` callerId="${escapeXml(callerId)}"` : '';
    return {
      contentType: 'text/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Dial${attr}>${escapeXml(to)}</Dial></Response>`,
    };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'text/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`,
    };
  }
}

/** Maps Twilio CallStatus values to ours. */
export const TWILIO_STATUS: Record<string, 'QUEUED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'CANCELED'> = {
  queued: 'QUEUED',
  initiated: 'QUEUED',
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  answered: 'IN_PROGRESS',
  completed: 'COMPLETED',
  busy: 'BUSY',
  failed: 'FAILED',
  'no-answer': 'NO_ANSWER',
  canceled: 'CANCELED',
};
