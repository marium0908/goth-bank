import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from './lib/server/auth';

const ROLE_ROUTES: Record<string, 'admin' | 'staff' | 'customer'> = {
  '/admin': 'admin',
  '/staff': 'staff',
  '/customer': 'customer',
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const matchedPrefix = Object.keys(ROLE_ROUTES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!matchedPrefix && pathname !== '/dashboard') {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }

  const requiredRole = matchedPrefix ? ROLE_ROUTES[matchedPrefix] : null;
  if (requiredRole && payload.role !== requiredRole) {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/customer/:path*', '/dashboard'],
};
