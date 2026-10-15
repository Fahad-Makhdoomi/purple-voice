import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env';
import { badRequest } from './http-error';

/**
 * Subscribers give us URLs we will POST to (webhooks, automations). Without
 * this check, a URL like http://127.0.0.1:5432 or the cloud metadata address
 * would let them make our server talk to its own private network.
 */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower.startsWith('ff')
  );
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
