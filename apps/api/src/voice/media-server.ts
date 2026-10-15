import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { logger } from '../lib/logger';
import { verifySubject } from '../lib/signed-url';
import { createTransport } from './transports';
import { CallSession } from './session';

const PATH = /^\/ws\/(twilio|plivo)\/([a-z0-9]+)\/([a-f0-9]{40})\/?$/;

/** Live sessions, for graceful shutdown and the health endpoint. */
export const liveSessions = new Set<CallSession>();

/**
 * Accepts carrier media streams at /ws/<provider>/<callId>/<sig>. The
 * signature was minted when we answered the call, so only the carrier we
 * handed the URL to can open the stream.
 */
export function attachMediaServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = url.pathname.match(PATH);
    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    const [, provider, callId, sig] = match;
    if (!verifySubject('media', callId, sig)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const transport = createTransport(provider, ws);
      if (!transport) return ws.close();
      const session = new CallSession(callId, transport);
      liveSessions.add(session);
      ws.on('close', () => liveSessions.delete(session));
      session.start().catch((err) => {
        logger.error({ err, callId }, 'Call session failed to start');
        ws.close();
      });
    });
  });

  return wss;
}
