import crypto from 'crypto';
import { whatsappConfig } from './whatsapp';

// ─────────────────────────────────────────────────────────────────────────────
// Meta WhatsApp Cloud API — X-Hub-Signature-256 verification (Phase 13A)
//
// Meta signs every webhook POST with HMAC-SHA256 over the EXACT raw request body
// using the app secret, sent as:  X-Hub-Signature-256: sha256=<hex>
//
// We must hash the unparsed bytes (which is why the webhook route uses a scoped
// express.raw parser), then compare in constant time. Fail closed: a missing
// secret, missing header, malformed header, or any mismatch returns false.
// ─────────────────────────────────────────────────────────────────────────────

export function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = whatsappConfig.appSecret;
  // Fail closed when not configured — never accept unsigned/unverifiable payloads.
  if (!secret) return false;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expected = Buffer.from(`sha256=${expectedHex}`, 'utf8');
  const received = Buffer.from(signatureHeader, 'utf8');

  // timingSafeEqual throws if lengths differ — guard first to keep it constant-time
  // on the comparison path and avoid leaking length via an exception.
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
