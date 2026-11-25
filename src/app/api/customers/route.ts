import { NextRequest, NextResponse } from 'next/server';
import { listCustomers, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    return NextResponse.json(listCustomers(user, searchParams.get('search') || ''));
  } catch (err) {
    return handleApiError(err, 'Unable to load customers.');
  }
}
