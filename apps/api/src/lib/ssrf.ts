import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { env } from '../config/env';
import { badRequest } from './http-error';

/**
 * Subscribers give us URLs we will POST to (webhooks, automations). Without
 * this check, a URL like http://127.0.0.1:5432 or the cloud metadata address
 * would let them make our server talk to its own private network.
 */

/**
 * Address ranges a customer-supplied URL must never reach: loopback, private,
 * link-local (cloud metadata), CGNAT, benchmarking, multicast/reserved, and
 * the IPv6 equivalents, including NAT64 and IPv4-mapped forms.
 */
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::', 96], // IPv4-compatible (deprecated)
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 can embed private IPv4
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(addr, prefix, 'ipv6');

/** IPv4 embedded in an IPv4-mapped IPv6 address, in either the dotted or hex form. */
function mappedV4(ip: string): string | null {
  const m = ip.toLowerCase().match(/^(?:0{0,4}:){0,4}:?(?:0{0,4}:)?ffff:(.+)$/);
  if (!m) return null;
  if (net.isIPv4(m[1]!)) return m[1]!;
  const hex = m[1]!.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = parseInt(hex[1]!, 16);
  const lo = parseInt(hex[2]!, 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return blocked.check(ip, 'ipv4');
  if (!net.isIPv6(ip)) return true; // not an address we understand: refuse
  const v4 = mappedV4(ip);
  if (v4) return blocked.check(v4, 'ipv4');
  return blocked.check(ip, 'ipv6');
}

/**
 * A host a subscriber asks us to open a connection to (their mail server),
 * resolved once: returns a public address to connect to, so the name can't
 * be re-pointed at a private one between the check and the connection.
 */
export async function resolvePublicHost(host: string): Promise<string> {
  const bare = host.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(bare)
    ? [bare]
    : (await dns.lookup(bare, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw badRequest(`Could not find the server ${host}`);
  if (env.isProd && addresses.some(isPrivateIp))
    throw badRequest('That server is on a private network');
  return addresses[0]!;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('Enter a valid URL');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !env.isProd)) {
    throw badRequest('Webhook URLs must use https');
  }
  if (url.username || url.password) throw badRequest('Remove credentials from the URL');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw badRequest(`Could not resolve ${host}`);
  if (env.isProd && addresses.some(isPrivateIp))
    throw badRequest('That URL points to a private network');
  return url;
}

/**
 * POSTs to a customer-supplied URL safely: the host is resolved once and the
 * connection is pinned to that checked public address (no DNS rebinding
 * between check and connect), and redirects are never followed.
 */
export async function postToPublicUrl(
  raw: string,
  opts: { headers: Record<string, string>; body: string; timeoutMs?: number },
): Promise<{ status: number; ok: boolean }> {
  const url = await assertPublicUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const address = await resolvePublicHost(host);
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: 'POST',
        headers: { ...opts.headers, 'Content-Length': Buffer.byteLength(opts.body).toString() },
        // Connect to the address we checked, keeping the hostname for TLS SNI and Host.
        lookup: (_h, options, cb) => {
          const family = net.isIPv6(address) ? 6 : 4;
          if ((options as { all?: boolean }).all)
            (cb as unknown as (e: null, a: Array<{ address: string; family: number }>) => void)(
              null,
              [{ address, family }],
            );
          else cb(null, address, family);
        },
        timeout: opts.timeoutMs ?? 10_000,
      },
      (res) => {
        res.resume(); // discard the body; we only need the status
        const status = res.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300 });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end(opts.body);
  });
}
