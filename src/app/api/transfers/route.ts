import { NextRequest, NextResponse } from 'next/server';
import { executeFundTransfer, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    const res = executeFundTransfer(user, body);
    return NextResponse.json(res.body, { status: res.status });
  } catch (err) {
    return handleApiError(err, 'Unable to process fund transfer atomically.');
  }
}
