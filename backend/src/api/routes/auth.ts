import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { authService, serializeUser } from '../../services/authService';
import { registerSchema, loginSchema } from '../../schemas/authSchemas';
import { setAuthCookie, clearAuthCookie, verifyToken, AUTH_COOKIE } from '../../lib/auth';

const router = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const input  = registerSchema.parse(req.body);
    const result = await authService.register(input);
    if (!result.ok) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    setAuthCookie(res, result.user.id);
    res.status(201).json({ user: serializeUser(result.user) });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/auth/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const input  = loginSchema.parse(req.body);
    const result = await authService.login(input);
    if (!result.ok) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    setAuthCookie(res, result.user.id);
    res.json({ user: serializeUser(result.user) });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Clears the cookie. Idempotent — safe to call when already logged out.
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(204).send();
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// PUBLIC boot-hydration endpoint. ALWAYS 200 — it reports auth state rather than
// gating, so a logged-out boot is clean (no 401 noise). Genuinely protected
// endpoints (/api/cases, /api/library, /api/cases/:id/*) still return 401 via
// requireAuth. A present-but-invalid/stale token is self-cleared, same as requireAuth.
router.get('/me', async (req: Request, res: Response) => {
  const token  = (req.cookies?.[AUTH_COOKIE] as string | undefined) ?? undefined;
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    if (token) clearAuthCookie(res);   // stale/invalid cookie → drop it
    res.json({ authenticated: false, user: null });
    return;
  }
  const user = await authService.getById(userId);
  if (!user) {
    clearAuthCookie(res);              // token valid but user gone
    res.json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user: serializeUser(user) });
});

export default router;
