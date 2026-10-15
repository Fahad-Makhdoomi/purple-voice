import http from 'node:http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createApp } from './app';
import { attachMediaServer, liveSessions } from './voice/media-server';

/**
 * The API process: REST + carrier webhooks + the media WebSocket bridge.
 * Background jobs run in a separate process (worker.ts) so a slow job can
 * never add latency to a live call.
 */
const app = createApp();
const server = http.createServer(app);
attachMediaServer(server);

// Long-lived media streams; don't let Node's defaults cut them.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`Purple Voice API listening on http://${env.API_HOST}:${env.API_PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, liveCalls: liveSessions.size }, 'Shutting down');
  server.close();
  // Give live calls up to 30 s to finish before the process exits.
  const deadline = Date.now() + 30_000;
  while (liveSessions.size && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
