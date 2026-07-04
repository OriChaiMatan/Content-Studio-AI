import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { WhatsAppIdentity } from '@prisma/client';
import { authService, serializeUser } from '../../services/authService';
import { registerSchema, loginSchema, changeWhatsappNumberSchema, forgotPasswordSchema, resetPasswordSchema } from '../../schemas/authSchemas';
import { setAuthCookie, clearAuthCookie, verifyToken, AUTH_COOKIE } from '../../lib/auth';
import { requireAuth } from '../middleware/auth';
import { authLoginLimiter, authRegisterLimiter, authForgotPasswordLimiter, authResetPasswordLimiter } from '../middleware/rateLimit';
import { whatsappConfig } from '../../lib/whatsapp';
import { emailService } from '../../services/emailService';
import { emailConfig } from '../../lib/emailConfig';
import { RESET_TTL_MINUTES } from '../../lib/passwordReset';

// Always-identical response for /forgot-password — never reveals whether the email exists.
const FORGOT_GENERIC = { message: "If an account exists for this email, we've sent a password reset link." };

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
router.post('/register', authRegisterLimiter, async (req: Request, res: Response) => {
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
router.post('/login', authLoginLimiter, async (req: Request, res: Response) => {
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

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
// Enumeration-safe: ALWAYS returns the same generic message and 200, whether or not
// the email maps to an account. A reset email is sent only when it does. Rate-limited.
router.post('/forgot-password', authForgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.createPasswordReset(email);
    if (result.ok && result.sent) {
      const resetUrl = `${emailConfig.appBaseUrl}/reset-password?token=${encodeURIComponent(result.token)}`;
      // Best-effort send — a provider failure must NOT change the response (no leak).
      await emailService.sendPasswordReset({
        to: result.user.email,
        name: result.user.name,
        resetUrl,
        expiresMinutes: RESET_TTL_MINUTES,
      }).catch(err => console.error('[POST /api/auth/forgot-password] email send error:', err instanceof Error ? err.message : err));
    }
    res.json(FORGOT_GENERIC);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/auth/forgot-password]', err);
    // Even on an unexpected error we avoid leaking; the client shows the same success UI.
    res.json(FORGOT_GENERIC);
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
// Consumes a one-time token and sets the new password. Invalid / expired / already-used
// tokens all return the same generic 400. Does NOT auth the user in (they sign in fresh).
router.post('/reset-password', authResetPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, password);
    if (!result.ok) {
      res.status(400).json({ error: 'invalid_or_expired', message: 'This password reset link is invalid or has expired.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[POST /api/auth/reset-password]', err);
    res.status(500).json({ error: 'Password reset failed' });
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
