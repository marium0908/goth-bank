import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/src/lib/server/auth';
import { registerNewCustomer } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = registerNewCustomer(body);
    const res = NextResponse.json(result, { status: 201 });
    res.cookies.set(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions(req));
    return res;
  } catch (err) {
    return handleApiError(err, 'Unable to register customer account.');
  }
}
