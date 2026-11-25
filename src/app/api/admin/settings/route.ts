import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminBankSettings,
  requireAuth,
  updateAdminBankSettings,
} from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    return NextResponse.json(getAdminBankSettings(user));
  } catch (err) {
    return handleApiError(err, 'Unable to fetch bank settings.');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(updateAdminBankSettings(user, body));
  } catch (err) {
    return handleApiError(err, 'Unable to update bank settings.');
  }
}
