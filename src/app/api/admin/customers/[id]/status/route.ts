import { NextRequest, NextResponse } from 'next/server';
import { adminUpdateCustomerStatus, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = requireAuth(req);
    const { id } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(adminUpdateCustomerStatus(user, Number(id), body));
  } catch (err) {
    return handleApiError(err, 'Unable to update customer status.');
  }
}
