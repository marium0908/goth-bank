import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/server/bankingService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user, token } = requireAuth(req);
    return NextResponse.json({ authenticated: true, user, token });
  } catch {
    return NextResponse.json({ authenticated: false, user: null, token: null });
  }
}
