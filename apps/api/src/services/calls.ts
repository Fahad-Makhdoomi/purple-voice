import type {
  Call,
  CallOutcome,
  CallStatus,
  Campaign,
  CampaignContact,
  ContactStatus,
  DialResult,
  Prisma,
} from '@prisma/client';
import { billableMinutes, TELEPHONY_PROVIDER_LABELS } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { badRequest, notFound, planLimit } from '../lib/http-error';
import { signedCallbackUrl } from '../lib/signed-url';
import { adapterForAccount, adapterForNumber } from '../telephony';
import { emitEvent } from '../events';
import { canStartCall, getEntitlements, recordUsage } from './entitlements';
import { summarizeCall, type TranscriptLine } from './ai/summarize';
import { dialResultFor, nextRetryAt } from './campaign-retry';
import { addToDoNotCall } from './do-not-call';

const TERMINAL: CallStatus[] = [
  'COMPLETED',
  'TRANSFERRED',
  'NO_ANSWER',
  'BUSY',
  'FAILED',
  'CANCELED',
];
export const isTerminal = (s: CallStatus) => TERMINAL.includes(s);

/** Gives the media stream a moment to flush the transcript before we summarise. */
const FINALIZE_DELAY_MS = 5000;

export interface OutboundCallInput {
  workspaceId: string;
  /** The AI agent that talks. Absent for a person calling from the browser dialer. */
  agentId?: string;
  /** The person calling from the browser dialer (voice/dialer-bridge.ts). */
  placedById?: string;
  phoneNumberId: string;
  to: string;
  campaignId?: string;
  contactId?: string;
}

/**
 * Places an outbound call. The Call row exists before the carrier is asked,
 * so every callback — answer, status, media — can find it by id from the
 * signed URL it was given.
 */
export async function startOutboundCall(input: OutboundCallInput): Promise<Call> {
  if (!input.agentId && !input.placedById) throw badRequest('Choose who makes the call');
  const gate = await canStartCall(input.workspaceId);
  if (!gate.ok) throw planLimit(gate.reason);

  const { number, adapter } = await adapterForNumber(input.phoneNumberId);
  if (number.workspaceId !== input.workspaceId) throw notFound('Phone number');
  if (adapter.mediaProtocol === 'none') {
    throw badRequest(
      input.agentId
        ? `${number.telephonyAccount.provider} numbers can't place AI calls yet`
        : `${TELEPHONY_PROVIDER_LABELS[number.telephonyAccount.provider]} numbers can't place browser calls. Use a Twilio or Plivo number.`,
    );
  }

  const call = await prisma.call.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      placedById: input.placedById,
      campaignId: input.campaignId,
      contactId: input.contactId,
      phoneNumberId: number.id,
      provider: number.telephonyAccount.provider,
      direction: 'OUTBOUND',
      fromNumber: number.e164,
      toNumber: input.to,
      status: 'QUEUED',
      startedAt: new Date(),
    },
  });

  try {
    const { providerCallId } = await adapter.placeCall({
      from: number.e164,
      to: input.to,
      answerUrl: signedCallbackUrl(call.provider, 'voice', 'callId', call.id),
      statusUrl: signedCallbackUrl(call.provider, 'status', 'callId', call.id),
    });
    return await prisma.call.update({ where: { id: call.id }, data: { providerCallId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Carrier rejected the call';
    await prisma.call.update({
      where: { id: call.id },
      data: { status: 'FAILED', endedAt: new Date(), errorMessage: message },
    });
    void finalizeCall(call.id);
    throw badRequest(`Could not place the call: ${message}`);
  }
}

/** Applies a carrier status update; terminal statuses schedule finalisation. */
export async function applyCallStatus(
  callId: string,
  status: CallStatus,
  extra: { durationSec?: number; providerCallId?: string } = {},
) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return;
  // A transferred call keeps that status even when the carrier later reports "completed".
  const next = call.status === 'TRANSFERRED' && isTerminal(status) ? 'TRANSFERRED' : status;
  const now = new Date();
  await prisma.call.update({
    where: { id: callId },
    data: {
      status: next,
      providerCallId: extra.providerCallId ?? undefined,
      answeredAt: next === 'IN_PROGRESS' && !call.answeredAt ? now : undefined,
      endedAt: isTerminal(next) && !call.endedAt ? now : undefined,
      durationSec: extra.durationSec !== undefined ? extra.durationSec : undefined,
    },
  });
  if (isTerminal(next)) setTimeout(() => void finalizeCall(callId), FINALIZE_DELAY_MS);
}

/**
 * Ends a call that is stuck: asks the carrier to hang up (best effort), then
 * closes the row ourselves so it stops counting as live and gets finalised.
 * A call nobody answered is CANCELED; one that connected is COMPLETED.
 */
export async function forceEndCall(workspaceId: string, callId: string): Promise<Call> {
  const call = await prisma.call.findFirst({
    where: { id: callId, workspaceId },
    include: { phoneNumber: { include: { telephonyAccount: true } } },
  });
  if (!call) throw notFound('Call');
  if (isTerminal(call.status)) throw badRequest('This call has already ended');

  if (call.providerCallId && call.phoneNumber) {
    await adapterForAccount(call.phoneNumber.telephonyAccount)
      .hangup(call.providerCallId)
      .catch((err) => logger.warn({ err, callId }, 'Carrier hangup failed during force end'));
  }
  await prisma.call.updateMany({
    where: { id: callId, endReason: null },
    data: { endReason: 'force_ended' },
  });
  await applyCallStatus(callId, call.answeredAt ? 'COMPLETED' : 'CANCELED');
  return prisma.call.findUniqueOrThrow({ where: { id: callId } });
}

/** Where a campaign contact stands once its call is over and no retry is due. */
export function contactStatusFor(result: DialResult, outcome: CallOutcome | null): ContactStatus {
  if (outcome === 'DO_NOT_CALL') return 'DO_NOT_CALL';
  if (result === 'REACHED') return 'COMPLETED';
  if (result === 'FAILED') return 'FAILED';
  return 'NO_ANSWER';
}

/**
 * The contact's next state after a campaign call: another try when the call
 * didn't reach them, the campaign retries that kind of result and attempts
 * are left; otherwise a final status. Do-not-call is never retried.
 */
export function contactAfterCall(
  contact: Pick<CampaignContact, 'attempts'>,
  campaign: Parameters<typeof nextRetryAt>[0] & Pick<Campaign, 'maxAttempts' | 'retryOn'>,
  result: DialResult,
  outcome: CallOutcome | null,
  now = new Date(),
): { status: ContactStatus; nextAttemptAt: Date | null } {
  const retry =
    result !== 'REACHED' &&
    outcome !== 'DO_NOT_CALL' &&
    outcome !== 'WRONG_NUMBER' &&
    campaign.retryOn.includes(result) &&
    contact.attempts < campaign.maxAttempts;
  if (retry) return { status: 'PENDING', nextAttemptAt: nextRetryAt(campaign, now) };
  return { status: contactStatusFor(result, outcome), nextAttemptAt: null };
}

/**
 * Post-call processing, exactly once per call: duration and billing,
 * usage metering, AI summary, contact and campaign progress, events.
 * Claimed with a conditional update so the status callback, the media
 * stream closing and the worker's sweep can all call it safely.
 */
export async function finalizeCall(callId: string): Promise<void> {
  const claimed = await prisma.call.updateMany({
    where: { id: callId, finalizedAt: null },
    data: { finalizedAt: new Date() },
  });
  if (!claimed.count) return;

  try {
    const call = await prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: { agent: true, contact: true, campaign: true },
    });
    const endedAt = call.endedAt ?? new Date();
    const durationSec =
      call.durationSec ||
      (call.answeredAt
        ? Math.max(0, Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000))
        : 0);
    const billedMinutes = billableMinutes(durationSec);
    if (billedMinutes > 0) await recordUsage(call.workspaceId, billedMinutes);

    let outcome: CallOutcome | null = call.outcome;
    let summary: string | null = call.summary;
    let sentiment: number | null = call.sentiment;
    const transcript = (call.transcript as unknown as TranscriptLine[]) ?? [];
    const ent = await getEntitlements(call.workspaceId);

    if (call.agent && ent.features.callSummary && transcript.length) {
      const result = await summarizeCall(call.workspaceId, call.agent, transcript);
      if (result) {
        summary = result.followUp
          ? `${result.summary}\n\nNext step: ${result.followUp}`
          : result.summary;
        outcome = outcome ?? result.outcome;
        sentiment = result.sentiment;
      }
    }
    if (!outcome) {
      if (call.status === 'TRANSFERRED') outcome = 'TRANSFERRED';
      else if (call.status === 'NO_ANSWER' || call.status === 'BUSY') outcome = null;
      else if (durationSec > 0) outcome = 'OTHER';
    }

    await prisma.call.update({
      where: { id: call.id },
      data: { endedAt, durationSec, billedMinutes, outcome, summary, sentiment },
    });

    // Asked not to be called: no campaign of this workspace calls them again.
    if (outcome === 'DO_NOT_CALL' && !call.placedById) {
      const theirs = call.direction === 'OUTBOUND' ? call.toNumber : call.fromNumber;
      await addToDoNotCall(call.workspaceId, theirs, 'call', `Asked on call ${call.id}`);
    }

    if (call.contact && call.campaign) {
      const result = dialResultFor({ ...call, durationSec }, outcome, transcript);
      const next = contactAfterCall(call.contact, call.campaign, result, outcome);
      await prisma.campaignContact.update({
        where: { id: call.contact.id },
        data: { ...next, lastOutcome: outcome, lastResult: result },
      });
    }

    const data: Record<string, unknown> = {
      callId: call.id,
      direction: call.direction,
      status: call.status,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      agentId: call.agentId,
      campaignId: call.campaignId,
      contactId: call.contactId,
      durationSec,
      outcome,
      sentiment,
      summary,
      transferredTo: call.transferredTo,
    };
    await emitEvent(
      call.workspaceId,
      call.status === 'TRANSFERRED' ? 'call.transferred' : 'call.completed',
      data,
    );
    if (call.contactId)
      await emitEvent(call.workspaceId, 'contact.updated', { contactId: call.contactId, outcome });
    if (call.campaignId) await completeCampaignIfDone(call.campaignId);
  } catch (err) {
    logger.error({ err, callId }, 'Call finalisation failed');
  }
}

/** Marks a running campaign complete once no contact is waiting or being called. */
export async function completeCampaignIfDone(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'RUNNING') return;
  const remaining = await prisma.campaignContact.count({
    where: { campaignId, status: { in: ['PENDING', 'CALLING'] } },
  });
  if (remaining) return;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  const stats = await prisma.campaignContact.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });
  await emitEvent(campaign.workspaceId, 'campaign.completed', {
    campaignId,
    name: campaign.name,
    contacts: Object.fromEntries(stats.map((s) => [s.status, s._count._all])),
  });
}

/** Persists a call's transcript. The live media session holds the authoritative copy in memory. */
export async function saveTranscript(callId: string, lines: TranscriptLine[]) {
  await prisma.call.update({
    where: { id: callId },
    data: { transcript: lines as unknown as Prisma.InputJsonValue },
  });
}
