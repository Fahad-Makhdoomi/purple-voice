import type { TelephonyProvider } from '@prisma/client';
import type { CallStatus } from '@pv/shared';
import { TWILIO_STATUS } from './twilio';
import { PLIVO_STATUS } from './plivo';
import { EXOTEL_STATUS } from './exotel';
import { VONAGE_STATUS } from './vonage';
import { bandwidthStatus } from './bandwidth';

/** What a carrier's voice or status webhook tells us, in one shape. */
export interface CallbackFields {
  providerCallId?: string;
  from?: string;
  to?: string;
  status?: CallStatus;
  durationSec?: number;
}

const str = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : String(v));

function num(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Twilio, SignalWire (LaML) and Telnyx (TeXML) share Twilio's form fields;
 * Plivo has its own names; Exotel, Vonage and Bandwidth post JSON events.
 */
export function callbackFields(
  p: TelephonyProvider,
  body: Record<string, unknown>,
): CallbackFields {
  switch (p) {
    case 'PLIVO':
      return {
        providerCallId: str(body.CallUUID),
        from: str(body.From),
        to: str(body.To),
        status: PLIVO_STATUS[String(body.CallStatus ?? '').toLowerCase()],
        durationSec: num(body.Duration, body.CallDuration),
      };
    case 'EXOTEL': {
      const event = String(body.EventType ?? '').toLowerCase();
      return {
        providerCallId: str(body.CallSid),
        from: str(body.From),
        to: str(body.To),
        status:
          event === 'answered'
            ? 'IN_PROGRESS'
            : EXOTEL_STATUS[String(body.Status ?? body.CallStatus ?? '').toLowerCase()],
        durationSec: num(body.ConversationDuration, body.Duration),
      };
    }
    case 'VONAGE': {
      // The WebSocket leg of a call reports its own events: they aren't the caller's.
      if (/^wss?:/i.test(String(body.to ?? '')) || /^wss?:/i.test(String(body.from ?? '')))
        return {};
      return {
        providerCallId: str(body.uuid),
        from: str(body.from),
        to: str(body.to),
        status: VONAGE_STATUS[String(body.status ?? '').toLowerCase()],
        durationSec: num(body.duration),
      };
    }
    case 'BANDWIDTH': {
      const answered = Date.parse(String(body.answerTime ?? ''));
      const ended = Date.parse(String(body.endTime ?? ''));
      return {
        providerCallId: str(body.callId),
        from: str(body.from),
        to: str(body.to),
        status: bandwidthStatus(body),
        durationSec:
          Number.isFinite(answered) && Number.isFinite(ended)
            ? Math.max(0, Math.round((ended - answered) / 1000))
            : undefined,
      };
    }
    default:
      // TWILIO, SIGNALWIRE, TELNYX (and SuperPhone, which never calls back).
      return {
        providerCallId: str(body.CallSid),
        from: str(body.From),
        to: str(body.To),
        status: TWILIO_STATUS[String(body.CallStatus ?? '').toLowerCase()],
        durationSec: num(body.CallDuration, body.Duration),
      };
  }
}
