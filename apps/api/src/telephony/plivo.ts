import {
  escapeXml,
  TelephonyError,
  type PlaceCallInput,
  type PlivoCredentials,
  type ProviderNumber,
  type TelephonyAdapter,
  type VoiceDocument,
} from './types';

const BASE = 'https://api.plivo.com/v1/Account';

/** Plivo uses bare digits for numbers in its API. */
const digits = (e164: string) => e164.replace(/^\+/, '');

/** Plivo Voice API + bidirectional Audio Streams. */
export class PlivoAdapter implements TelephonyAdapter {
  readonly provider = 'PLIVO' as const;
  readonly mediaProtocol = 'plivo' as const;

  constructor(private readonly creds: PlivoCredentials) {}

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, json?: unknown) {
    const res = await fetch(`${BASE}/${this.creds.authId}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.creds.authId}:${this.creds.authToken}`).toString('base64')}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 204) return {} as T;
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new TelephonyError(body.error ?? `Plivo error ${res.status}`, res.status);
    return body;
  }

  async verify() {
    const acct = await this.request<{ name?: string; auth_id: string }>('GET', '/');
    return { label: acct.name || acct.auth_id };
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    const data = await this.request<{ objects: Array<{ number: string; alias?: string | null }> }>(
      'GET',
      '/Number/?limit=20',
    );
    return data.objects.map((n) => ({
      id: n.number,
      e164: `+${n.number}`,
      friendlyName: n.alias ?? undefined,
    }));
  }

  /**
   * Plivo routes numbers through an Application. We keep one application per
   * connected number (its answer URL is signed for that number) and attach it.
   */
  async configureInbound(input: {
    e164: string;
    numberId: string;
    inboundUrl: string;
    statusUrl: string;
    existingAppId?: string | null;
  }) {
    const appBody = {
      answer_url: input.inboundUrl,
      answer_method: 'POST',
      hangup_url: input.statusUrl,
      hangup_method: 'POST',
    };
    let appId = input.existingAppId ?? undefined;
    if (appId) {
      await this.request('POST', `/Application/${appId}/`, appBody);
    } else {
      const app = await this.request<{ app_id: string }>('POST', '/Application/', {
        app_name: `purplevoice-${input.numberId}`,
        ...appBody,
      });
      appId = app.app_id;
    }
    await this.request('POST', `/Number/${digits(input.e164)}/`, { app_id: appId });
    return { providerNumberId: digits(input.e164), appId };
  }

  async placeCall(input: PlaceCallInput) {
    const call = await this.request<{ request_uuid: string | string[] }>('POST', '/Call/', {
      from: digits(input.from),
      to: digits(input.to),
      answer_url: input.answerUrl,
      answer_method: 'POST',
      hangup_url: input.statusUrl,
      hangup_method: 'POST',
      ring_url: input.statusUrl,
      ring_method: 'POST',
      ring_timeout: input.ringTimeoutSec ?? 30,
    });
    const id = Array.isArray(call.request_uuid) ? call.request_uuid[0] : call.request_uuid;
    if (!id) throw new TelephonyError('Plivo did not return a call id');
    return { providerCallId: id };
  }

  async transferCall(providerCallId: string, _to: string, documentUrl: string) {
    await this.request('POST', `/Call/${providerCallId}/`, {
      legs: 'aleg',
      aleg_url: documentUrl,
      aleg_method: 'POST',
    });
  }

  async hangup(providerCallId: string) {
    await this.request('DELETE', `/Call/${providerCallId}/`);
  }

  streamDocument(wsUrl: string): VoiceDocument {
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${escapeXml(wsUrl)}</Stream></Response>`,
    };
  }

  transferDocument(to: string, callerId?: string): VoiceDocument {
    const attr = callerId ? ` callerId="${escapeXml(digits(callerId))}"` : '';
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Dial${attr}><Number>${escapeXml(digits(to))}</Number></Dial></Response>`,
    };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${escapeXml(message)}</Speak><Hangup/></Response>`,
    };
  }
}

/** Maps Plivo CallStatus values (ring/answer/hangup callbacks) to ours. */
export const PLIVO_STATUS: Record<
  string,
  'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'CANCELED'
> = {
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  busy: 'BUSY',
  failed: 'FAILED',
  timeout: 'NO_ANSWER',
  'no-answer': 'NO_ANSWER',
  cancel: 'CANCELED',
  canceled: 'CANCELED',
};
