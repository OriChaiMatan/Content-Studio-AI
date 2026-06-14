import { Prisma, type WhatsAppIdentity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { canEcho } from '../lib/whatsapp';
import { sendText } from '../lib/whatsappSend';
import { phoneDigits, normalizeCodeInput, MAX_VERIFY_ATTEMPTS } from '../lib/whatsappVerification';
import { ingestFromWhatsapp } from './whatsappIngestionService';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp service (Phase 13A — plumbing only)
//
// Responsibilities in 13A:
//   - Parse the Meta Cloud API webhook envelope into flat inbound messages.
//   - Persist each inbound message IDEMPOTENTLY (dedupe on Meta's message id).
//   - Optionally send a gated echo reply (only when canEcho()).
//
// Explicitly NOT here yet: phone→user resolution, source ingestion, case
// selection, notifications, AI. Those are later phases.
// ─────────────────────────────────────────────────────────────────────────────

// ── Meta payload shapes (minimal — only the fields 13A reads) ─────────────────

interface MetaTextMessage {
  from: string;        // sender phone in E.164-ish digits (no '+')
  id: string;          // "wamid...." — globally unique, our idempotency key
  timestamp?: string;
  type: string;        // "text" | "image" | ... (13A only acts on "text")
  text?: { body?: string };
}

interface MetaChangeValue {
  messaging_product?: string;
  messages?: MetaTextMessage[];
  statuses?: unknown[];   // delivery/read receipts — logged-as-ignored in 13A
}

interface MetaEntry {
  id?: string;
  changes?: { value?: MetaChangeValue; field?: string }[];
}

export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaEntry[];
}

// Flattened inbound message extracted from the envelope.
export interface InboundMessage {
  waMessageId: string;
  from: string;
  type: string;
  body: string;   // text body, or '' for non-text types in 13A
}

// ── Envelope parsing ──────────────────────────────────────────────────────────
// Pulls every message out of entry[].changes[].value.messages[]. Tolerant of
// missing/extra fields — Meta sends status callbacks with no `messages` array,
// which yield an empty list (we simply log nothing for those).
export function extractInboundMessages(payload: MetaWebhookPayload): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (!msg?.id || !msg?.from) continue;
        out.push({
          waMessageId: msg.id,
          from: msg.from,
          type: msg.type ?? 'unknown',
          body: msg.type === 'text' ? (msg.text?.body ?? '') : '',
        });
      }
    }
  }
  return out;
}

// ── Idempotent inbound logging ────────────────────────────────────────────────
// Returns true if a NEW row was written, false if this waMessageId was already
// logged (Meta retry). Relies on the @unique constraint on waMessageId: we catch
// the P2002 unique-violation rather than pre-checking, so concurrent retries can't
// race past a read-then-write gap.
async function logInbound(msg: InboundMessage, rawMessage: unknown): Promise<boolean> {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        waMessageId: msg.waMessageId,
        phoneE164: msg.from,
        direction: 'inbound',
        kind: 'inbound',
        body: msg.body,
        raw: rawMessage as Prisma.InputJsonValue,
      },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false;   // duplicate waMessageId — already logged
    }
    throw err;
  }
}

// ── Identity resolution ───────────────────────────────────────────────────────
// Registration stores '+E.164'; Meta's `from` is digit-only, so we reconstruct the
// canonical '+<digits>' for the unique lookup.
async function resolveIdentity(from: string): Promise<WhatsAppIdentity | null> {
  return prisma.whatsAppIdentity.findUnique({ where: { phoneE164: `+${phoneDigits(from)}` } });
}

// ── 13B inbound verification ──────────────────────────────────────────────────
// Match the message body against an UNVERIFIED identity's code. Caller resolves the
// identity and only calls this when it exists and is not yet verified.
//
// Structural safety: matching binds to phoneE164 == sender, so a number can only
// ever verify ITSELF — cross-account verification is impossible by construction.
type VerifyStatus = 'verified' | 'wrong' | 'expired' | 'locked';

async function runVerification(identity: WhatsAppIdentity, body: string): Promise<VerifyStatus> {
  // Expired or no active code → needs a resend.
  if (!identity.verifyCode || !identity.verifyExpires || identity.verifyExpires.getTime() < Date.now()) {
    return 'expired';
  }
  // Too many wrong attempts → locked until a resend regenerates the code.
  if (identity.attemptCount >= MAX_VERIFY_ATTEMPTS) return 'locked';

  if (normalizeCodeInput(body) !== identity.verifyCode) {
    await prisma.whatsAppIdentity.update({
      where: { id: identity.id },
      data:  { attemptCount: { increment: 1 } },
    });
    return 'wrong';
  }

  // Match — flip to verified and clear the transient secret.
  await prisma.whatsAppIdentity.update({
    where: { id: identity.id },
    data:  { verified: true, verifiedAt: new Date(), verifyCode: null, verifyExpires: null, attemptCount: 0 },
  });
  return 'verified';
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
// Process a signature-verified webhook payload: log each inbound message
// idempotently, then branch by sender identity state:
//   no identity   → 13A generic echo (debug only)
//   unverified    → 13B verification
//   verified      → 13C source ingestion
// Returns a small summary for the route's debug log. Never throws (errors are
// logged and swallowed) so the webhook can always return 200 to Meta.
export async function processInbound(payload: MetaWebhookPayload): Promise<{ received: number; logged: number; verified: number; ingested: number; echoed: number }> {
  const messages = extractInboundMessages(payload);
  let logged = 0;
  let verified = 0;
  let ingested = 0;
  let echoed = 0;

  for (const msg of messages) {
    try {
      // Dedupe FIRST so Meta retries are full no-ops (no double verify / ingest / echo).
      const isNew = await logInbound(msg, msg);
      if (isNew) logged++;
      if (!isNew) continue;

      const identity = await resolveIdentity(msg.from);

      // ── No identity for this number → 13A generic echo (debug only) ───────────
      if (!identity) {
        if (msg.type === 'text' && msg.body && canEcho()) {
          const ok = await sendText(msg.from, `Received: ${msg.body}`);
          if (ok) echoed++;
        }
        continue;
      }

      // ── Unverified identity → 13B verification ────────────────────────────────
      if (!identity.verified) {
        if (msg.type !== 'text') continue;   // only text can carry a code
        const vstatus = await runVerification(identity, msg.body);
        if (vstatus === 'verified') {
          verified++;
          if (canEcho()) await sendText(msg.from, '✓ Your WhatsApp number is now verified.');
        } else if (vstatus === 'expired' || vstatus === 'locked') {
          if (canEcho()) await sendText(msg.from, 'That code is no longer valid. Request a new code in the app and try again.');
        }
        // 'wrong' → silent (attempt already counted).
        continue;
      }

      // ── Verified identity → 13C source ingestion ──────────────────────────────
      const result = await ingestFromWhatsapp(identity, msg);
      if (result.ingested) ingested++;
    } catch (err) {
      console.error('[whatsapp] processInbound error for', msg.waMessageId, err instanceof Error ? err.message : err);
    }
  }

  return { received: messages.length, logged, verified, ingested, echoed };
}
