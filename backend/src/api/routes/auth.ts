import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { WhatsAppIdentity } from '@prisma/client';
import { authService, serializeUser } from '../../services/authService';
import { registerSchema, loginSchema, changeWhatsappNumberSchema } from '../../schemas/authSchemas';
import { setAuthCookie, clearAuthCookie, verifyToken, AUTH_COOKIE } from '../../lib/auth';
import { requireAuth } from '../middleware/auth';
import { whatsappConfig } from '../../lib/whatsapp';

const router = Router();

// Phase 13B — owner-only verification payload returned by register/resend/change.
// Carries the PLAINTEXT code + the FULL number (so /verify-whatsapp can display
// them) and the dialable business number. Never sent via /me.
function verificationPayload(identity: WhatsAppIdentity, code: string) {
  return {
    phoneE164:      identity.phoneE164,
    code,
    expiresAt:      identity.verifyExpires ? identity.verifyExpires.toISOString() : null,
    businessNumber: whatsappConfig.displayNumber || null,
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const input  = registerSchema.parse(req.body);
    const result = await authService.register(input);
    if (!result.ok) {
      if (result.code === 'phone_taken') {
        res.status(409).json({ error: 'That WhatsApp number is already linked to another account' });
        return;
      }
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    setAuthCookie(res, result.user.id);
    const identity = result.user.whatsappIdentity;
    res.status(201).json({
      user: serializeUser(result.user, identity),
      // Owner-only: the plaintext code for the /verify-whatsapp screen.
      whatsappVerification: identity?.verifyCode ? verificationPayload(identity, identity.verifyCode) : null,
    });
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
    res.json({ user: serializeUser(result.user, result.user.whatsappIdentity) });
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
  res.json({ authenticated: true, user: serializeUser(user, user.whatsappIdentity) });
});

// ── POST /api/auth/whatsapp/resend (Phase 13B) ───────────────────────────────
// Authed + self-scoped. Regenerates the verification code + 60-min expiry and
// resets the attempt counter. Returns the fresh code for the verify screen.
router.post('/whatsapp/resend', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await authService.resendWhatsappCode(req.userId!);
    if (!result.ok) {
      // Already verified → no new code issued; report it plainly (not an error).
      if (result.code === 'already_verified') {
        res.json({ alreadyVerified: true });
        return;
      }
      res.status(409).json({ error: 'No WhatsApp number is linked to this account' });
      return;
    }
    res.json({ whatsappVerification: verificationPayload(result.identity, result.code) });
  } catch (err) {
    console.error('[POST /api/auth/whatsapp/resend]', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// ── PATCH /api/auth/whatsapp/number (Phase 13B) ──────────────────────────────
// Authed + self-scoped. Re-points the number, resets to unverified, issues a fresh
// code. Rejects a number already linked to another account.
router.patch('/whatsapp/number', requireAuth, async (req: Request, res: Response) => {
  try {
    const { whatsappPhone } = changeWhatsappNumberSchema.parse(req.body);
    const result = await authService.changeWhatsappNumber(req.userId!, whatsappPhone);
    if (!result.ok) {
      if (result.code === 'phone_taken') {
        res.status(409).json({ error: 'That WhatsApp number is already linked to another account' });
        return;
      }
      res.status(409).json({ error: 'No WhatsApp number is linked to this account' });
      return;
    }
    res.json({ whatsappVerification: verificationPayload(result.identity, result.code) });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[PATCH /api/auth/whatsapp/number]', err);
    res.status(500).json({ error: 'Failed to change number' });
  }
});

export default router;
