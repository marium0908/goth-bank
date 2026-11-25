import { NextRequest, NextResponse } from 'next/server';
import { markNotificationRead, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = requireAuth(req);
    const { id } = await context.params;
    return NextResponse.json(markNotificationRead(user.id, Number(id)));
  } catch (err) {
    return handleApiError(err, 'Unable to update notification.');
  }
}
