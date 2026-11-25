import { NextResponse } from 'next/server';
import { getDb } from '@/src/lib/server/db';

export const runtime = 'nodejs';

export async function GET() {
  getDb();
  return NextResponse.json({ ok: true });
}
