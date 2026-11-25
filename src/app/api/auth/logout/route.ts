import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/src/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, '', getAuthCookieOptions(req, 0));
  return res;
}
