import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, staffOpenAccount } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(staffOpenAccount(user, body), { status: 201 });
  } catch (err) {
    return handleApiError(err, 'Unable to open bank account.');
  }
}
