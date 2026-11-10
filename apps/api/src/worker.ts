import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { dialerTick } from './jobs/dialer';
import { deliverWebhooks } from './jobs/webhooks';
import { maintenanceTick } from './jobs/maintenance';
import { crmTick } from './jobs/crm';
import { syncAllGoogleCalendars } from './services/calendar';
import { lifecycleTick } from './services/lifecycle-emails';

/**
 * Background worker: campaign dialer, new-lead calls, webhook deliveries, maintenance,
 * and the onboarding and upgrade emails.
 * Run exactly one instance. Each loop skips a tick if the previous one is
 * still running, so a slow pass never stacks up.
 */
function loop(name: string, intervalMs: number, fn: () => Promise<void>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error({ err, job: name }, 'Job failed');
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}

const timers = [
  loop('dialer', env.DIALER_INTERVAL_MS, dialerTick),
  loop('crm', 5_000, crmTick),
  loop('webhooks', 5_000, deliverWebhooks),
  loop('maintenance', 60_000, maintenanceTick),
  loop('calendar-sync', 5 * 60_000, syncAllGoogleCalendars),
  loop('lifecycle-emails', 10 * 60_000, () => lifecycleTick()),
];
logger.info('Purple Voice worker started');

async function shutdown() {
  timers.forEach(clearInterval);
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
