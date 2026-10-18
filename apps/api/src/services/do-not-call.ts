import { prisma } from '../lib/prisma';

/**
 * The workspace's do-not-call list. Someone who asks not to be called on any
 * call is never dialled again by any campaign of that workspace (TCPA
 * internal do-not-call list; PECR and GDPR right to object).
 */

export async function addToDoNotCall(
  workspaceId: string,
  phone: string,
  source: 'call' | 'manual' | 'import',
  note?: string,
) {
  await prisma.doNotCallNumber.upsert({
    where: { workspaceId_phone: { workspaceId, phone } },
    create: { workspaceId, phone, source, note },
    update: {},
  });
  // Nobody in any campaign of this workspace is called on that number again.
  await prisma.campaignContact.updateMany({
    where: { workspaceId, phone, status: { in: ['PENDING', 'NO_ANSWER', 'FAILED'] } },
    data: { status: 'DO_NOT_CALL', nextAttemptAt: null },
  });
}

export async function isOnDoNotCall(workspaceId: string, phone: string): Promise<boolean> {
  return !!(await prisma.doNotCallNumber.findUnique({
    where: { workspaceId_phone: { workspaceId, phone } },
    select: { id: true },
  }));
}

/** Marks a campaign's waiting contacts whose numbers are on the list; returns how many. */
export async function applyDoNotCall(campaignId: string, workspaceId: string): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "CampaignContact" c SET status = 'DO_NOT_CALL', "nextAttemptAt" = NULL, "updatedAt" = now()
    FROM "DoNotCallNumber" d
    WHERE c."campaignId" = ${campaignId} AND d."workspaceId" = ${workspaceId}
      AND d.phone = c.phone AND c.status = 'PENDING'`;
  return result;
}
