import { NextResponse, type NextRequest } from 'next/server';

/**
 * Where redirects point. Behind nginx, Next.js builds `req.nextUrl` from its
 * own listen address (https://localhost:3000), not the public host, so the
 * public site URL — inlined at build time — is used instead.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function redirectTo(req: NextRequest, pathAndQuery: string) {
  return NextResponse.redirect(new URL(pathAndQuery, SITE_URL || req.nextUrl.origin));
}

/**
 * Routing convenience only: sends signed-out visitors to the login page and
 * subscribers away from /admin before any JavaScript loads. The `pv_role`
 * cookie is not trusted for access — every API call is authorised by the
 * API itself from the HTTP-only session cookie.
 */
export function middleware(req: NextRequest) {
  const role = req.cookies.get('pv_role')?.value;
  const { pathname, search } = req.nextUrl;

  if (!role) return redirectTo(req, `/login?next=${encodeURIComponent(pathname + search)}`);
  if (pathname.startsWith('/admin') && role === 'SUBSCRIBER') return redirectTo(req, '/dashboard');
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };
