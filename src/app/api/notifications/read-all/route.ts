import { NextRequest, NextResponse } from 'next/server';
import { markAllNotificationsRead, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    return NextResponse.json(markAllNotificationsRead(user.id));
  } catch (err) {
    return handleApiError(err, 'Unable to mark notifications read.');
  }
}
