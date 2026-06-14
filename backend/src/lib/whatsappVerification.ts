import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp verification primitives (Phase 13B)
//
// Shared by registration, the resend/change-number routes, AND the inbound webhook
// matcher — so phone normalization and code semantics have a SINGLE source of truth.
// User-initiated verification: the user sends `verifyCode` from their WhatsApp to
// the business number; the webhook matches sender phone + code.
// ─────────────────────────────────────────────────────────────────────────────

// 60-minute code lifetime (product decision).
export const VERIFY_TTL_MS = 60 * 60 * 1000;

// Strict E.164: a leading '+', a non-zero country digit, then 7–14 more digits.
// MVP rejects local formats (no libphonenumber) — callers surface a clear error.
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_RE.test(phone);
}

// Canonical digit key for MATCHING only. Registration stores the '+E.164' string;
// Meta's inbound `from` is digit-only (no '+'). Reducing both to bare digits lets
// "+972501234567" (stored) reconcile with "972501234567" (inbound). Never used as
// the stored value — only as a comparison key.
export function phoneDigits(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

// 6-char code over an unambiguous alphabet (no 0/O/1/I/L) — easy to read/type in a
// WhatsApp message. crypto.randomInt for unbiased selection.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

export function codeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + VERIFY_TTL_MS);
}

// Normalize an inbound message body to compare against a stored code: trim and
// uppercase (the alphabet is uppercase). Tolerates a user typing/pasting with case
// or surrounding whitespace.
export function normalizeCodeInput(body: string): string {
  return (body ?? '').trim().toUpperCase();
}

// Max wrong-code attempts before the code is invalidated (forces a resend).
export const MAX_VERIFY_ATTEMPTS = 5;

// Mask a phone for serialization to the client: keep the country prefix hint and
// last 2 digits. "+972501234567" → "+9725…34". The user's own number, so low risk;
// masking is just tidiness/defense-in-depth.
export function maskPhone(phone: string): string {
  if (!phone) return '';
  if (phone.length <= 6) return phone;
  const head = phone.slice(0, 5);
  const tail = phone.slice(-2);
  return `${head}…${tail}`;
}
