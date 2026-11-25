import { NextRequest, NextResponse } from 'next/server';
import { getAdminAnalyticsOverview, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    return NextResponse.json(getAdminAnalyticsOverview(user));
  } catch (err) {
    return handleApiError(err, 'Unable to load analytics.');
  }
}
