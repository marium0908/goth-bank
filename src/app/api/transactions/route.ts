import { NextRequest, NextResponse } from 'next/server';
import { listTransactions, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    return NextResponse.json(
      listTransactions(user, {
        search: searchParams.get('search') || undefined,
        txType: searchParams.get('txType') || undefined,
        status: searchParams.get('status') || undefined,
        flagged: searchParams.get('flagged') === 'true',
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        accountId: searchParams.get('accountId') ? Number(searchParams.get('accountId')) : null,
        userId: searchParams.get('userId') ? Number(searchParams.get('userId')) : null,
        page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 12,
      })
    );
  } catch (err) {
    return handleApiError(err, 'Unable to load transactions.');
  }
}
