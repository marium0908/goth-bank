import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    return NextResponse.json(
      listAccounts(user, {
        search: searchParams.get('search') || undefined,
        status: searchParams.get('status') || undefined,
      })
    );
  } catch (err) {
    return handleApiError(err, 'Unable to fetch accounts.');
  }
}
