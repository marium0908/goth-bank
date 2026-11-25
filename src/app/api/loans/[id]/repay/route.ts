import { NextRequest, NextResponse } from 'next/server';
import { repayLoanInstallment, requireAuth } from '@/src/lib/server/bankingService';
import { handleApiError } from '@/src/lib/server/routeHelper';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = requireAuth(req);
    const { id } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(repayLoanInstallment(user, Number(id), body));
  } catch (err) {
    return handleApiError(err, 'Failed to process loan repayment.');
  }
}
