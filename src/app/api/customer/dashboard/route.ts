import { NextRequest, NextResponse } from 'next/server';
import { getCustomerDashboardData, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const accountIdRaw = searchParams.get('accountId');
    const accountId = accountIdRaw ? Number(accountIdRaw) : null;
    return NextResponse.json(getCustomerDashboardData(user.id, accountId));
  } catch (err) {
    return handleApiError(err, 'Unable to load customer dashboard.');
  }
}
