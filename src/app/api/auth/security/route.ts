import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateUserSecurity } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(updateUserSecurity(user.id, body));
  } catch (err) {
    return handleApiError(err, 'Unable to update security settings.');
  }
}
