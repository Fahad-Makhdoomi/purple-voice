import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/jwt';
import { verifySubject } from '../lib/signed-url';
import { ACCESS_COOKIE } from '../middleware/auth';
import { isTerminal } from '../services/calls';
import { createTransport } from './transports';
import { CallSession } from './session';
import { dialerBridges, endReasonFor, type DialerBridge } from './dialer-bridge';

const CARRIER_PATH = /^\/ws\/(twilio|plivo)\/([a-z0-9]+)\/([a-f0-9]{40})\/?$/;
const DIALER_PATH = /^\/ws\/dialer\/([a-z0-9]+)\/([a-f0-9]{40})\/?$/;
/** A browser that misses a ping for this long is gone. */
const HEARTBEAT_MS = 10_000;

/** Live AI sessions and dialer calls, for graceful shutdown and the health endpoint. */
export const liveSessions = new Set<CallSession | DialerBridge>();

function reject(socket: Duplex, status: 401 | 403 | 404 | 500) {
  const text = { 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Server Error' };
  socket.write(`HTTP/1.1 ${status} ${text[status]}\r\n\r\n`);
  socket.destroy();
}

function cookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Two kinds of WebSocket share this server:
 *
 *   /ws/<provider>/<callId>/<sig>  carrier media streams. The signature was
 *     minted when we answered the call, so only the carrier we handed the URL
 *     to can open the stream. Calls placed from the browser dialer go to the
 *     dialer bridge; every other call gets an AI CallSession.
 *   /ws/dialer/<callId>/<sig>      the browser of the person who placed a
 *     dialer call. It needs the signature returned when the call was placed
 *     and that same person's session cookie.
 */
export function attachMediaServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  dialerBridges.hooks.opened = (bridge) => liveSessions.add(bridge);
  dialerBridges.hooks.closed = (bridge) => liveSessions.delete(bridge);

  async function acceptCarrier(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    provider: string,
    callId: string,
  ) {
    // Decide before the upgrade, so the bridge or session is listening when the first frame arrives.
    const bridged = !!dialerBridges.get(callId);
    const call = bridged
      ? null
      : await prisma.call.findUnique({
          where: { id: callId },
          select: { placedById: true, status: true },
        });

    wss.handleUpgrade(req, socket, head, (ws) => {
      const transport = createTransport(provider, ws);
      if (!transport) return ws.close();

      if (bridged || call?.placedById) {
        // The person hung up before the stream arrived: nothing to connect it to.
        if (!dialerBridges.get(callId) && call && isTerminal(call.status)) {
          return transport.close();
        }
        dialerBridges.open(callId).attachCarrier(transport);
        return;
      }

      const session = new CallSession(callId, transport);
      liveSessions.add(session);
      ws.on('close', () => liveSessions.delete(session));
      session.start().catch((err) => {
        logger.error({ err, callId }, 'Call session failed to start');
        ws.close();
      });
    });
  }

  async function acceptBrowser(req: IncomingMessage, socket: Duplex, head: Buffer, callId: string) {
    // Browsers always send Origin; it must be our own site.
    const origin = req.headers.origin;
    if (origin && origin !== env.appUrl && !env.corsOrigins.includes(origin)) {
      return reject(socket, 403);
    }
    const claims = verifyAccessToken(cookie(req.headers.cookie, ACCESS_COOKIE) ?? '');
    if (!claims) return reject(socket, 401);

    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { placedById: true, status: true, answeredAt: true },
    });
    if (!call?.placedById || call.placedById !== claims.sub) return reject(socket, 404);

    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!dialerBridges.get(callId) && isTerminal(call.status)) {
        // Already over (a reload after hanging up, say): say so and close.
        const reason = endReasonFor(call.status, !!call.answeredAt);
        ws.send(JSON.stringify({ type: 'status', status: 'ended', reason }));
        ws.close(1000, 'ended');
        return;
      }
      // A laptop that sleeps or loses Wi-Fi never closes its socket; ping it, so
      // the call is hung up instead of leaving the callee talking to nobody.
      let alive = true;
      ws.on('pong', () => (alive = true));
      const heartbeat = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, HEARTBEAT_MS);
      ws.on('close', () => clearInterval(heartbeat));
      dialerBridges.open(callId).attachBrowser(ws);
    });
  }

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    const dialer = url.pathname.match(DIALER_PATH);
    if (dialer) {
      const [, callId, sig] = dialer;
      if (!verifySubject('dialer', callId, sig)) return reject(socket, 403);
      acceptBrowser(req, socket, head, callId).catch((err) => {
        logger.error({ err, callId }, 'Dialer socket failed to open');
        reject(socket, 500);
      });
      return;
    }

    const match = url.pathname.match(CARRIER_PATH);
    if (!match) return reject(socket, 404);
    const [, provider, callId, sig] = match;
    if (!verifySubject('media', callId, sig)) return reject(socket, 403);
    acceptCarrier(req, socket, head, provider, callId).catch((err) => {
      logger.error({ err, callId }, 'Media stream failed to open');
      reject(socket, 500);
    });
  });

  return wss;
}
