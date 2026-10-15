import type { Call, CallOutcome, CallStatus, ContactStatus, Prisma } from '@prisma/client';
import { billableMinutes } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { badRequest, notFound, planLimit } from '../lib/http-error';
import { signedCallbackUrl } from '../lib/signed-url';
import { adapterForNumber } from '../telephony';
import { emitEvent } from '../events';
import { canStartCall, getEntitlements, recordUsage } from './entitlements';
import { summarizeCall, type TranscriptLine } from './ai/summarize';

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
  agentId: string;
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
  const gate = await canStartCall(input.workspaceId);
  if (!gate.ok) throw planLimit(gate.reason);

  const { number, adapter } = await adapterForNumber(input.phoneNumberId);
  if (number.workspaceId !== input.workspaceId) throw notFound('Phone number');
  if (adapter.mediaProtocol === 'none') {
    throw badRequest(`${number.telephonyAccount.provider} numbers can't place AI calls yet`);
  }

  const call = await prisma.call.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
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

function contactStatusFor(
  call: Pick<Call, 'status'>,
  outcome: CallOutcome | null,
): ContactStatus | null {
  if (outcome === 'DO_NOT_CALL') return 'DO_NOT_CALL';
  if (call.status === 'NO_ANSWER' || call.status === 'BUSY' || outcome === 'VOICEMAIL')
    return 'NO_ANSWER';
  if (call.status === 'FAILED' || call.status === 'CANCELED') return 'FAILED';
  return 'COMPLETED';
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

    if (call.contact && call.campaign) {
      const status = contactStatusFor(call, outcome);
      const retry =
        status === 'NO_ANSWER' && call.contact.attempts < call.campaign.maxAttempts
          ? new Date(Date.now() + call.campaign.retryDelayMinutes * 60_000)
          : null;
      await prisma.campaignContact.update({
        where: { id: call.contact.id },
        data: {
          status: retry ? 'PENDING' : (status ?? 'COMPLETED'),
          nextAttemptAt: retry,
          lastOutcome: outcome,
        },
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
