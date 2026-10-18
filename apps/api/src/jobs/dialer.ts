import { Prisma, type Campaign, type RetryStrategy } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { HttpError } from '../lib/http-error';
import { completeCampaignIfDone, startOutboundCall } from '../services/calls';
import { retryHours, withinWindow } from '../services/campaign-retry';
import { utcToZoned, isValidTimeZone } from '../voice/time';

const FRESH_ONLY = Prisma.sql`AND attempts = 0`;
const RETRIES_ONLY = Prisma.sql`AND attempts > 0`;

/**
 * Who is called next. END_OF_LIST and NEXT_DAY go round the list in rounds:
 * everyone's first call, then every first retry, and so on. AFTER_DELAY
 * calls back a due retry before starting on numbers not tried yet.
 */
export function dialOrder(strategy: RetryStrategy): Prisma.Sql {
  return strategy === 'AFTER_DELAY'
    ? Prisma.sql`ORDER BY (attempts = 0), "nextAttemptAt" NULLS LAST, "createdAt"`
    : Prisma.sql`ORDER BY attempts, "nextAttemptAt" NULLS FIRST, "createdAt"`;
}

/** Whether "now" falls inside the campaign's calling days and hours, in its own time zone. */
export function withinCallWindow(
  c: Pick<Campaign, 'timezone' | 'callDays' | 'callWindowStart' | 'callWindowEnd'>,
  now = new Date(),
): boolean {
  const tz = isValidTimeZone(c.timezone) ? c.timezone : 'UTC';
  const local = utcToZoned(now, tz);
  return (
    c.callDays.includes(local.weekday) &&
    local.time >= c.callWindowStart &&
    local.time < c.callWindowEnd
  );
}

/**
 * Seconds until the campaign may start its next call: it waits
 * `callDelaySeconds` after the last call started and after the last one
 * ended, whichever is later.
 */
export function secondsUntilNextCall(
  delaySeconds: number,
  last: { createdAt: Date; endedAt: Date | null } | null,
  lastEndedAt: Date | null,
  now = new Date(),
): number {
  const latest = Math.max(last?.createdAt.getTime() ?? 0, lastEndedAt?.getTime() ?? 0);
  if (!latest) return 0;
  return Math.max(0, Math.ceil((latest + delaySeconds * 1000 - now.getTime()) / 1000));
}

/**
 * One pass of the campaign dialer. For each running campaign inside its
 * call window whose pause between calls has passed, starts the next due
 * contact if a concurrency slot is free — one call per pause, so calls are
 * spaced out even with several lines. Contacts are claimed with FOR UPDATE
 * SKIP LOCKED, so a second worker (or an overlapping tick) can never dial the
 * same person twice.
 */
export async function dialerTick(): Promise<void> {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'RUNNING' },
    include: { agent: { select: { status: true } } },
  });

  for (const campaign of campaigns) {
    if (campaign.agent.status !== 'ACTIVE') continue;
    // New numbers are called in the call window; retries in the retry hours
    // (the call window too, unless the campaign has its own retry hours).
    const freshOk = withinCallWindow(campaign);
    const hours = retryHours(campaign);
    const retryOk = withinWindow(campaign.callDays, hours.start, hours.end, campaign.timezone);
    if (!freshOk && !retryOk) continue;

    const [live, last, ended] = await Promise.all([
      prisma.call.count({
        where: { campaignId: campaign.id, status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS'] } },
      }),
      prisma.call.findFirst({
        where: { campaignId: campaign.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, endedAt: true },
      }),
      prisma.call.aggregate({ where: { campaignId: campaign.id }, _max: { endedAt: true } }),
    ]);
    if (campaign.concurrency - live <= 0) continue;
    if (secondsUntilNextCall(campaign.callDelaySeconds, last, ended._max.endedAt) > 0) continue;
    const slots = 1;

    const which = freshOk && retryOk ? Prisma.empty : freshOk ? FRESH_ONLY : RETRIES_ONLY;
    const claimed = await prisma.$queryRaw<Array<{ id: string; phone: string }>>`
      UPDATE "CampaignContact"
      SET status = 'CALLING', attempts = attempts + 1, "lastAttemptAt" = now(), "updatedAt" = now()
      WHERE id IN (
        SELECT id FROM "CampaignContact"
        WHERE "campaignId" = ${campaign.id}
          AND status = 'PENDING'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
          ${which}
        ${dialOrder(campaign.retryStrategy)}
        LIMIT ${slots}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, phone`;

    if (!claimed.length) {
      await completeCampaignIfDone(campaign.id);
      continue;
    }

    for (const contact of claimed) {
      try {
        await startOutboundCall({
          workspaceId: campaign.workspaceId,
          agentId: campaign.agentId,
          phoneNumberId: campaign.phoneNumberId,
          to: contact.phone,
          campaignId: campaign.id,
          contactId: contact.id,
        });
      } catch (err) {
        if (err instanceof HttpError && err.code === 'plan_limit') {
          // Out of minutes or concurrency: put the contact back untouched.
          await prisma.campaignContact.update({
            where: { id: contact.id },
            data: { status: 'PENDING', attempts: { decrement: 1 } },
          });
          if (/minutes/i.test(err.message)) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'PAUSED' },
            });
            logger.info({ campaignId: campaign.id }, 'Campaign paused: minutes used up');
          }
          break;
        }
        // Carrier rejected the number: the failed call was finalised and the contact marked.
        logger.warn({ err, campaignId: campaign.id, contactId: contact.id }, 'Dial failed');
      }
    }
  }
}
