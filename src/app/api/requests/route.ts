import { NextRequest, NextResponse } from 'next/server';
import {
  createDepositWithdrawRequest,
  listDepositWithdrawRequests,
  requireAuth,
} from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    return NextResponse.json(listDepositWithdrawRequests(user));
  } catch (err) {
    return handleApiError(err, 'Unable to load requests.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(createDepositWithdrawRequest(user, body), { status: 201 });
  } catch (err) {
    return handleApiError(err, 'Unable to create request.');
  }
}
