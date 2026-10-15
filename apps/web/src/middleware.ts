import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routing convenience only: sends signed-out visitors to the login page and
 * subscribers away from /admin before any JavaScript loads. The `pv_role`
 * cookie is not trusted for access — every API call is authorised by the
 * API itself from the HTTP-only session cookie.
 */
export function middleware(req: NextRequest) {
  const role = req.cookies.get('pv_role')?.value;
  const { pathname, search } = req.nextUrl;

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && role === 'SUBSCRIBER') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };
