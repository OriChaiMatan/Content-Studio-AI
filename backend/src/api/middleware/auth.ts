import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AUTH_COOKIE, verifyToken, clearAuthCookie } from '../../lib/auth';

// Browser-extension support: the SAME stateless JWT may arrive in the httpOnly
// cookie (web app, sameSite=lax) OR as `Authorization: Bearer <jwt>`. The Chrome
// extension can't send the lax cookie cross-origin, so it reads the existing
// cookie via chrome.cookies and forwards it here as a Bearer token. Additional
// transport only — no new token type, no auth-architecture change.
export function tokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const bearer = header.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  return undefined;
}

// Phase 12 — gate: reject unauthenticated requests and attach req.userId.
// Reads the JWT from the httpOnly cookie set at login/register (or a Bearer header).
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromRequest(req);
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    // If a token was PRESENT but failed verification (expired, or signed with a
    // different/old JWT_SECRET), proactively clear the stale cookie so the client
    // stops re-presenting a dead token and a clean re-login can take over.
    if (token) clearAuthCookie(res);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.userId = userId;
  next();
}

// Phase 12 — STRICT ownership for any /api/cases/:id|:caseId route. Used as an
// Express router.param handler so it runs before the route's own handler. A missing
// case OR a case owned by another user both return 404 (no existence leak, never 403).
// Because all children (sources/outputs/pipeline runs/steps) hang off ContentCase,
// guarding the parent id covers every nested route without touching the AI pipeline.
export async function requireCaseOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
  caseId: string,
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const found = await prisma.contentCase.findUnique({
      where: { id: caseId },
      select: { userId: true },
    });
    if (!found || found.userId !== req.userId) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    next();
  } catch (err) {
    console.error('[requireCaseOwnership]', err);
    res.status(500).json({ error: 'Ownership check failed' });
  }
}
