import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { decrypt, hmacSha256Hex } from '../lib/crypto';
import { assertPublicUrl } from '../lib/ssrf';

const MAX_ATTEMPTS = 8;
const BATCH = 25;

/** 30 s, 1 m, 2 m, 4 m … capped at 6 h. */
function backoffMs(attempt: number) {
  return Math.min(30_000 * 2 ** (attempt - 1), 6 * 60 * 60 * 1000);
}

/**
 * Header a receiver verifies: `t=<unix>,v1=<hex hmac-sha256(secret, "<t>.<body>")>`.
 * The timestamp lets receivers reject replays.
 */
export function signatureHeader(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmacSha256Hex(secret, `${timestamp}.${body}`)}`;
}

/** Sends due webhook deliveries, retrying failures with exponential backoff. */
export async function deliverWebhooks(): Promise<void> {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: 'asc' },
    take: BATCH,
    include: { endpoint: true },
  });

  await Promise.all(
    due.map(async (delivery) => {
      // Lease the row for a minute so a slow request isn't sent twice.
      const leased = await prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PENDING', nextAttemptAt: delivery.nextAttemptAt },
        data: { nextAttemptAt: new Date(Date.now() + 60_000) },
      });
      if (!leased.count) return;

      const attempts = delivery.attempts + 1;
      const body = JSON.stringify(delivery.payload);
      let status: number | null = null;
      let error: string | null = null;

      if (!delivery.endpoint.active) {
        error = 'Endpoint disabled';
      } else {
        try {
          const url = await assertPublicUrl(delivery.endpoint.url);
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'PurpleVoice-Webhooks/1.0',
              'X-PurpleVoice-Event': delivery.event,
              'X-PurpleVoice-Delivery': delivery.id,
              'X-PurpleVoice-Signature': signatureHeader(decrypt(delivery.endpoint.secretEnc), body),
            },
            body,
            redirect: 'manual',
            signal: AbortSignal.timeout(10_000),
          });
          status = res.status;
          if (!res.ok) error = `HTTP ${res.status}`;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
      }

      const succeeded = !error;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          responseStatus: status,
          lastError: error,
          status: succeeded ? 'SUCCEEDED' : attempts >= MAX_ATTEMPTS || !delivery.endpoint.active ? 'FAILED' : 'PENDING',
          deliveredAt: succeeded ? new Date() : null,
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      });
      if (!succeeded) logger.debug({ deliveryId: delivery.id, error }, 'Webhook delivery failed');
    }),
  );
}
