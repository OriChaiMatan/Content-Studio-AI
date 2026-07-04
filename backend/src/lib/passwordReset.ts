import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Password-reset token primitives — the SINGLE source of truth for token
// generation, hashing and lifetime.
//
// Security model:
//   • The RAW token is 32 bytes of CSPRNG entropy, base64url-encoded, and travels
//     only inside the reset link emailed to the user. It is NEVER stored or logged.
//   • Only the SHA-256 hash is persisted (unique column), so a database leak cannot
//     be used to reset passwords. Lookup is by hash — no plaintext comparison.
//   • Lifetime is 60 minutes.
// ─────────────────────────────────────────────────────────────────────────────

// 60-minute reset-link lifetime (product decision; mirrors the WhatsApp code TTL).
export const RESET_TTL_MS = 60 * 60 * 1000;
export const RESET_TTL_MINUTES = RESET_TTL_MS / 60_000;

// 32 bytes = 256 bits of entropy — far beyond brute-force. base64url is URL-safe
// (no +, /, = to escape) so it drops straight into a query string.
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

// SHA-256 is the right primitive here (not bcrypt): the token already has full
// entropy, so a fast unkeyed digest is both sufficient and lets us look up by the
// unique hash column. No per-token salt is needed for high-entropy secrets.
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function resetExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TTL_MS);
}
