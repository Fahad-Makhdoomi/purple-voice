import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { dialerTick } from './jobs/dialer';
import { deliverWebhooks } from './jobs/webhooks';
import { maintenanceTick } from './jobs/maintenance';

/**
 * Background worker: campaign dialer, webhook deliveries, maintenance.
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
  loop('webhooks', 5_000, deliverWebhooks),
  loop('maintenance', 60_000, maintenanceTick),
];
logger.info('Purple Voice worker started');

async function shutdown() {
  timers.forEach(clearInterval);
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
