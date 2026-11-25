import { NextRequest, NextResponse } from 'next/server';
import { createTwoFactorChallenge, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(createTwoFactorChallenge(user.id, body));
  } catch (err) {
    return handleApiError(err, 'Unable to generate verification challenge.');
  }
}
