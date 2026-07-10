import jwt from 'jsonwebtoken';
import type { Response } from 'express';

// Phase 12 — authentication primitives. Stateless JWT carried in an httpOnly cookie
// (no DB session table). The secret signs the token; rotating it invalidates all
// sessions. We fail fast in production if it is unset rather than fall back to a
// known-weak default.
const JWT_SECRET = process.env.JWT_SECRET ?? '';
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production.');
}
const SECRET = JWT_SECRET || 'dev-only-insecure-secret';

export const AUTH_COOKIE = 'cs_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload { sub: string }

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload;
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
}

// httpOnly so JS can't read it (XSS-resistant); sameSite=lax is safe for a same-origin
// SPA; secure only in production (dev is http://localhost). Path '/' so it rides every
// /api request.
export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

// Make req.userId available across the app once requireAuth has run.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      // Set by requireCaseOwnership (api/middleware/auth.ts) for any case-scoped
      // route (:id / :caseId param) — read by requireActiveCase to reject
      // mutations on archived cases.
      caseLifecycleStatus?: 'ACTIVE' | 'ARCHIVED';
    }
  }
}
