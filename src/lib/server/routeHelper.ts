import { NextResponse } from 'next/server';
import { HttpError } from './auth';

export function handleApiError(err: unknown, fallbackMessage = 'Internal server error.'): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.message, ...(err.extra || {}) },
      { status: err.status }
    );
  }
  console.error('API route error:', err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
