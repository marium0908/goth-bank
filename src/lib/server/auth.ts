import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NextRequest } from 'next/server';

export type UserRole = 'admin' | 'staff' | 'customer';

export const AUTH_COOKIE_NAME = 'goth_bank_session';

export interface AuthTokenPayload {
  sub: number;
  role: UserRole;
  email: string;
  exp: number;
  jti: string;
}

export interface AuthenticatedUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: string;
  kyc_verified: number;
  two_factor_enabled: number;
  address: string;
  created_at: string;
}

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const globalForAuth = globalThis as unknown as {
  __gothBankRuntimeSecret?: Buffer;
};

function getSigningKey(): Buffer {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  if (process.env.VERCEL) {
    const deploymentSeed = `${process.env.VERCEL_PROJECT_ID || process.env.VERCEL_URL || 'goth-bank'}:${process.env.VERCEL_GIT_COMMIT_SHA || 'vercel'}`;
    return crypto.createHash('sha256').update(deploymentSeed).digest();
  }
  if (!globalForAuth.__gothBankRuntimeSecret) {
    const secretDir = path.join(os.tmpdir(), 'goth_bank_data');
    const secretFile = path.join(secretDir, '.session_secret');
    try {
      if (fs.existsSync(secretFile)) {
        const stored = fs.readFileSync(secretFile, 'utf8').trim();
        if (stored.length >= 32) {
          globalForAuth.__gothBankRuntimeSecret = Buffer.from(stored, 'hex');
        }
      }
      if (!globalForAuth.__gothBankRuntimeSecret) {
        fs.mkdirSync(secretDir, { recursive: true });
        const generated = crypto.randomBytes(32);
        fs.writeFileSync(secretFile, generated.toString('hex'), { mode: 0o600 });
        globalForAuth.__gothBankRuntimeSecret = generated;
      }
    } catch {
      globalForAuth.__gothBankRuntimeSecret = crypto.randomBytes(32);
    }
  }
  return globalForAuth.__gothBankRuntimeSecret;
}

export function hashSecret(plainText: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plainText: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const actualBuf = crypto.scryptSync(plainText, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function signAuthToken(user: { id: number; role: UserRole; email: string }): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 12,
    jti: crypto.randomUUID(),
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encoded)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (!parsed || typeof parsed.sub !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  return cookieToken ? cookieToken.trim() : null;
}

export function getAuthCookieOptions(req?: NextRequest, maxAgeSeconds = 60 * 60 * 12) {
  const isHttps = req
    ? req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:'
    : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function requireRole(user: AuthenticatedUser, ...roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new HttpError(403, 'Insufficient permissions for this action.');
  }
}
