import crypto from 'node:crypto';
import {
  TelephonyError,
  type PlaceCallInput,
  type ProviderNumber,
  type TelephonyAdapter,
  type VoiceDocument,
  type VonageCredentials,
} from './types';

const API = 'https://api.nexmo.com';
const REST = 'https://rest.nexmo.com';

/** Vonage uses bare digits for numbers. */
const digits = (e164: string) => e164.replace(/\D/g, '');

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** A Voice API JWT (RS256) for the application, valid for 15 minutes. */
export function vonageJwt(applicationId: string, privateKey: string, nowSec = Date.now() / 1000) {
  const iat = Math.floor(nowSec);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      application_id: applicationId,
      iat,
      exp: iat + 900,
      jti: crypto.randomUUID(),
    }),
  );
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey)
    .toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Vonage audio over the WebSocket: 16-bit linear PCM at 8 kHz, like the phone line. */
export const VONAGE_CONTENT_TYPE = 'audio/l16;rate=8000';

/**
 * Vonage Voice API. The subscriber's Vonage application signs our calls
 * (JWT with its private key); its answer and event URLs are pointed at
 * Purple Voice for the whole account, and each connected number is linked
 * to that application. Incoming calls are matched by the number dialled.
 *
 * Call control documents are NCCO (JSON). Audio goes over a `websocket`
 * endpoint as binary 16-bit linear PCM frames (VonageTransport).
 */
export class VonageAdapter implements TelephonyAdapter {
  readonly provider = 'VONAGE' as const;
  readonly mediaProtocol = 'vonage' as const;
  readonly inboundRouting = 'account' as const;
  readonly manualInbound = false;

  constructor(private readonly creds: VonageCredentials) {}

  private basic() {
    return `Basic ${Buffer.from(`${this.creds.apiKey}:${this.creds.apiSecret}`).toString('base64')}`;
  }

  private async request<T>(
    url: string,
    init: { method: string; auth: 'jwt' | 'basic'; json?: unknown; form?: Record<string, string> },
  ) {
    let authorization: string;
    try {
      authorization =
        init.auth === 'jwt'
          ? `Bearer ${vonageJwt(this.creds.applicationId, this.creds.privateKey)}`
          : this.basic();
    } catch {
      throw new TelephonyError('The Vonage private key could not be read', 400);
    }
    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        ...(init.json ? { 'Content-Type': 'application/json' } : {}),
        ...(init.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: init.json
        ? JSON.stringify(init.json)
        : init.form
          ? new URLSearchParams(init.form)
          : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 204) return {} as T;
    const body = (await res.json().catch(() => ({}))) as T & {
      title?: string;
      detail?: string;
      'error-code-label'?: string;
    };
    if (!res.ok || ('error-code' in body && String(body['error-code']) !== '200')) {
      throw new TelephonyError(
        body.detail ?? body.title ?? body['error-code-label'] ?? `Vonage error ${res.status}`,
        res.status,
      );
    }
    return body;
  }

  private application() {
    return this.request<{
      id: string;
      name: string;
      capabilities?: Record<string, Record<string, unknown>>;
    }>(`${API}/v2/applications/${encodeURIComponent(this.creds.applicationId)}`, {
      method: 'GET',
      auth: 'basic',
    });
  }

  async verify() {
    const app = await this.application();
    // Proves the private key belongs with the account too (a signed call to the Voice API).
    await this.request(`${API}/v1/calls?page_size=1`, { method: 'GET', auth: 'jwt' });
    return { label: app.name };
  }

  private async numbers() {
    // The Numbers API authenticates with the key and secret as query parameters.
    const q = new URLSearchParams({
      api_key: this.creds.apiKey,
      api_secret: this.creds.apiSecret,
      size: '100',
    });
    const data = await this.request<{
      numbers?: Array<{ msisdn: string; country: string; app_id?: string }>;
    }>(`${REST}/account/numbers?${q}`, { method: 'GET', auth: 'basic' });
    return data.numbers ?? [];
  }

  async listNumbers(): Promise<ProviderNumber[]> {
    return (await this.numbers()).map((n) => ({
      id: n.msisdn,
      e164: `+${n.msisdn}`,
      friendlyName: n.country,
    }));
  }

  /**
   * Sets the application's answer and event URLs (keeping its other
   * capabilities) and links the number to the application.
   */
  async configureInbound(input: {
    e164: string;
    accountInboundUrl: string;
    accountStatusUrl: string;
  }) {
    const app = await this.application();
    const voice = (app.capabilities?.voice ?? {}) as { webhooks?: Record<string, unknown> };
    await this.request(`${API}/v2/applications/${encodeURIComponent(app.id)}`, {
      method: 'PUT',
      auth: 'basic',
      json: {
        name: app.name,
        capabilities: {
          ...app.capabilities,
          voice: {
            ...voice,
            webhooks: {
              ...voice.webhooks,
              answer_url: { address: input.accountInboundUrl, http_method: 'POST' },
              event_url: { address: input.accountStatusUrl, http_method: 'POST' },
            },
          },
        },
      },
    });
    const msisdn = digits(input.e164);
    const number = (await this.numbers()).find((n) => n.msisdn === msisdn);
    if (!number)
      throw new TelephonyError(`${input.e164} is not a number on this Vonage account`, 404);
    await this.request(`${REST}/number/update`, {
      method: 'POST',
      auth: 'basic',
      form: {
        api_key: this.creds.apiKey,
        api_secret: this.creds.apiSecret,
        country: number.country,
        msisdn,
        app_id: app.id,
      },
    });
    return { providerNumberId: msisdn };
  }

  async placeCall(input: PlaceCallInput) {
    const call = await this.request<{ uuid?: string }>(`${API}/v1/calls`, {
      method: 'POST',
      auth: 'jwt',
      json: {
        to: [{ type: 'phone', number: digits(input.to) }],
        from: { type: 'phone', number: digits(input.from) },
        answer_url: [input.answerUrl],
        answer_method: 'POST',
        event_url: [input.statusUrl],
        event_method: 'POST',
        ringing_timer: input.ringTimeoutSec ?? 30,
      },
    });
    if (!call.uuid) throw new TelephonyError('Vonage did not return a call id');
    return { providerCallId: call.uuid };
  }

  async hangup(providerCallId: string) {
    try {
      await this.request(`${API}/v1/calls/${encodeURIComponent(providerCallId)}`, {
        method: 'PUT',
        auth: 'jwt',
        json: { action: 'hangup' },
      });
    } catch (err) {
      // Already over.
      if (!(err instanceof TelephonyError) || (err.status !== 404 && err.status !== 400)) throw err;
    }
  }

  streamDocument(wsUrl: string, intro?: string): VoiceDocument {
    const ncco: unknown[] = [];
    if (intro) ncco.push({ action: 'talk', text: intro });
    ncco.push({
      action: 'connect',
      endpoint: [{ type: 'websocket', uri: wsUrl, 'content-type': VONAGE_CONTENT_TYPE }],
    });
    return { contentType: 'application/json', body: JSON.stringify(ncco) };
  }

  sayAndHangupDocument(message: string): VoiceDocument {
    return {
      contentType: 'application/json',
      body: JSON.stringify([{ action: 'talk', text: message }]),
    };
  }
}

/** Vonage call event "status" values to ours. */
export const VONAGE_STATUS: Record<
  string,
  'QUEUED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'CANCELED'
> = {
  started: 'QUEUED',
  ringing: 'RINGING',
  answered: 'IN_PROGRESS',
  completed: 'COMPLETED',
  busy: 'BUSY',
  failed: 'FAILED',
  rejected: 'FAILED',
  timeout: 'NO_ANSWER',
  unanswered: 'NO_ANSWER',
  cancelled: 'CANCELED',
};
