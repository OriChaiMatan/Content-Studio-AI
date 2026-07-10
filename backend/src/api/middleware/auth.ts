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

// Roles/Plans/Usage (Phase 2) — gate for MASTER-only endpoints (e.g. changing
// another user's plan). systemRole isn't in the JWT (see lib/auth.ts — the
// token carries only the userId), so this always does a fresh DB read rather
// than trust a claim that could go stale the moment MASTER_EMAILS changes.
export async function requireMaster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { systemRole: true } });
    if (!user || user.systemRole !== 'MASTER') {
      res.status(403).json({ error: 'Master access required' });
      return;
    }
    next();
  } catch (err) {
    console.error('[requireMaster]', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
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
      select: { userId: true, lifecycleStatus: true },
    });
    if (!found || found.userId !== req.userId) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    req.caseLifecycleStatus = found.lifecycleStatus;
    next();
  } catch (err) {
    console.error('[requireCaseOwnership]', err);
    res.status(500).json({ error: 'Ownership check failed' });
  }
}

// Archived cases are read-only (browse/search/read/copy/download/view-history
// only — see the approved Content Case Lifecycle plan). Applied AFTER
// requireCaseOwnership (which populates req.caseLifecycleStatus) to every
// mutating route on a case-scoped router. 409 (not 403): the request is
// authorized, just rejected because of the resource's current state.
export function requireActiveCase(req: Request, res: Response, next: NextFunction): void {
  if (req.caseLifecycleStatus === 'ARCHIVED') {
    res.status(409).json({ error: 'This case is archived and read-only.', code: 'case_archived' });
    return;
  }
  next();
}
