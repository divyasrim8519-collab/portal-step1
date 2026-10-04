import { NextResponse } from 'next/server';

const PUBLIC = ['/login', '/api/auth/login', '/api/health'];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const hasCookie = req.cookies.has('portal_session');
  const isPublic = PUBLIC.some((p) => pathname === p);

  let res;
  if (!hasCookie && !isPublic && !pathname.startsWith('/api/')) {
    res = NextResponse.redirect(new URL('/login', req.url));
  } else {
    res = NextResponse.next();
  }
  // Real session validation happens on the server in every route; this is only a fast redirect.
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
