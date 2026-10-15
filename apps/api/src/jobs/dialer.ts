import type { Campaign } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { HttpError } from '../lib/http-error';
import { completeCampaignIfDone, startOutboundCall } from '../services/calls';
import { utcToZoned, isValidTimeZone } from '../voice/time';

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
 * One pass of the campaign dialer. For each running campaign inside its
 * call window, fills free concurrency slots with the next due contacts.
 * Contacts are claimed with FOR UPDATE SKIP LOCKED, so a second worker (or
 * an overlapping tick) can never dial the same person twice.
 */
export async function dialerTick(): Promise<void> {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'RUNNING' },
    include: { agent: { select: { status: true } } },
  });

  for (const campaign of campaigns) {
    if (campaign.agent.status !== 'ACTIVE' || !withinCallWindow(campaign)) continue;

    const live = await prisma.call.count({
      where: { campaignId: campaign.id, status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS'] } },
    });
    const slots = campaign.concurrency - live;
    if (slots <= 0) continue;

    const claimed = await prisma.$queryRaw<Array<{ id: string; phone: string }>>`
      UPDATE "CampaignContact"
      SET status = 'CALLING', attempts = attempts + 1, "lastAttemptAt" = now(), "updatedAt" = now()
      WHERE id IN (
        SELECT id FROM "CampaignContact"
        WHERE "campaignId" = ${campaign.id}
          AND status = 'PENDING'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
        ORDER BY "nextAttemptAt" NULLS FIRST, "createdAt"
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
