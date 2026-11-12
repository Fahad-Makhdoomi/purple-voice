import type { TelephonyProvider } from '@prisma/client';
import { publicWsUrl } from '../config/env';
import { signSubject } from '../lib/signed-url';

/** Media stream URL. Signature in the path because Twilio drops query strings on stream URLs. */
export function mediaStreamUrl(p: TelephonyProvider, callId: string): string {
  return publicWsUrl(`/ws/${p.toLowerCase()}/${callId}/${signSubject('media', callId)}`);
}

/** Media stream of the person an AI call is being transferred to, by the AI call's id. */
export function legStreamUrl(p: TelephonyProvider, callId: string): string {
  return publicWsUrl(`/ws/leg/${p.toLowerCase()}/${callId}/${signSubject('leg-media', callId)}`);
}

/** Exotel's inbound stream: the Voicebot applet opens it per call, signed for the number. */
export function inboundStreamUrl(p: TelephonyProvider, numberId: string): string {
  return publicWsUrl(`/ws/${p.toLowerCase()}/in/${numberId}/${signSubject('inbound', numberId)}`);
}
