import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { RateLimitRequestHandler, RateLimitInfo } from 'express-rate-limit';
import { imageGenConfig } from '../../lib/visualConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Phase Security-1 — Rate limiting (cost-abuse + brute-force protection).
//
// Uses express-rate-limit's default in-memory store: zero infra, fine for a
// SINGLE-instance Railway deployment. (Horizontal scaling later would need a
// shared store like Redis — intentionally out of scope here. Counters reset on
// restart, which only clears limits briefly; it is not a security hole.)
//
// IMPORTANT: app.ts sets `trust proxy = 1` so req.ip is the real client IP behind
// Railway's single proxy hop (not the proxy, and not client-spoofable).
//
// Keying:
//   - auth endpoints  → IP-based (no userId exists pre-login)
//   - AI / ingestion  → userId-based (requireAuth guarantees req.userId), with an
//                        IP fallback purely as defense-in-depth.
// ─────────────────────────────────────────────────────────────────────────────

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Minimal env surface. Master switch defaults ON (production-safe) unless the var
// is explicitly the string "false". Per-group max overrides are optional.
export const rateLimitConfig = {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  authMax: envInt('AUTH_RATE_LIMIT_MAX', 10),   // login / 15 min / IP
  aiMax: envInt('AI_RATE_LIMIT_MAX', 30),       // AI-heavy / 60 min / user
  ingestMax: envInt('INGEST_RATE_LIMIT_MAX', 60), // ingestion / 60 min / user
};

const MINUTE = 60_000;

// Default skip: off when disabled by env, and ALWAYS off under NODE_ENV=test so the
// normal suite is never throttled. Limiter UNIT tests bypass this by passing an
// explicit skipFn (see makeLimiter) so they can exercise real limiting behavior.
function defaultSkip(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return !rateLimitConfig.enabled;
}

// Shared 429 handler — the agreed API contract. retryAfter (seconds) is derived
// from the limiter's reset time when available.
function rateLimitHandler(req: Request, res: Response): void {
  const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
  const resetTime = info?.resetTime;
  const retryAfter = resetTime
    ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : undefined;
  res.status(429).json({
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
    ...(retryAfter !== undefined ? { retryAfter } : {}),
  });
}

export interface LimiterOptions {
  windowMs: number;
  max: number;
  scope: 'ip' | 'user';
}

// Factory. `skipFn` is injectable so unit tests can force a live limiter
// (skipFn = () => false) while production limiters use the env/test-aware default.
// Each call creates its own in-memory store, so limiter instances are isolated.
export function makeLimiter(
  opts: LimiterOptions,
  skipFn: () => boolean = defaultSkip,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-7', // RateLimit + Retry-After headers
    legacyHeaders: false,
    keyGenerator:
      opts.scope === 'user'
        ? (req: Request) => req.userId ?? ipKeyGenerator(req.ip ?? '')
        : (req: Request) => ipKeyGenerator(req.ip ?? ''),
    skip: () => skipFn(),
    handler: rateLimitHandler,
  });
}

// ── Named limiters (attached to exact routes) ────────────────────────────────
// Auth — IP-based.
export const authLoginLimiter = makeLimiter({ windowMs: 15 * MINUTE, max: rateLimitConfig.authMax, scope: 'ip' });
export const authRegisterLimiter = makeLimiter({ windowMs: 60 * MINUTE, max: 5, scope: 'ip' });
// Password recovery — IP-based, deliberately tight to blunt enumeration probing and
// email-bombing. Forgot: 5 / 15 min. Reset (token submit): 10 / 15 min (brute-force floor).
export const authForgotPasswordLimiter = makeLimiter({ windowMs: 15 * MINUTE, max: 5, scope: 'ip' });
export const authResetPasswordLimiter = makeLimiter({ windowMs: 15 * MINUTE, max: 10, scope: 'ip' });

// AI-heavy (shared) — user-based. pipeline start/run/advance + output regenerate.
export const aiHeavyLimiter = makeLimiter({ windowMs: 60 * MINUTE, max: rateLimitConfig.aiMax, scope: 'user' });

// Ingestion — user-based. sources + sources/batch (covers URL extraction, which
// runs inside these handlers — there is no separate extraction route).
export const ingestionLimiter = makeLimiter({ windowMs: 60 * MINUTE, max: rateLimitConfig.ingestMax, scope: 'user' });

// Visual generation — user-based. The priciest action (image API $/image); given
// its own limit, NOT shared with the AI-text limiter. Max from imageGenConfig.
export const imageGenLimiter = makeLimiter({ windowMs: 60 * MINUTE, max: imageGenConfig.rateLimitMax, scope: 'user' });

// Public marketing-site contact form — no auth, so IP-based. Tight enough to
// blunt spam/abuse while allowing a real visitor to retry after a mistake.
export const contactLimiter = makeLimiter({ windowMs: 15 * MINUTE, max: 5, scope: 'ip' });
