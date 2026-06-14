import { Router } from 'express';
import type { Request, Response } from 'express';
import { whatsappConfig } from '../../lib/whatsapp';
import { verifySignature } from '../../lib/whatsappSignature';
import { processInbound, type MetaWebhookPayload } from '../../services/whatsappService';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API webhook (Phase 13A — plumbing only)
//
// PUBLIC router (no requireAuth) — Meta calls it with no cookie. Trust comes from:
//   GET  → hub.verify_token must equal WHATSAPP_VERIFY_TOKEN
//   POST → X-Hub-Signature-256 HMAC over the RAW body must verify
//
// This router is mounted with a SCOPED express.raw() parser (see app.ts) so
// req.body is the unparsed Buffer needed for HMAC. Do not add express.json here.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── GET /api/integrations/whatsapp/webhook ────────────────────────────────────
// Meta verification handshake. ALWAYS available (even when WHATSAPP_ENABLED=false)
// so the webhook can be registered before the feature is switched on.
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    whatsappConfig.verifyToken.length > 0 &&
    token === whatsappConfig.verifyToken
  ) {
    // Echo the challenge verbatim as text/plain — Meta expects the raw value.
    res.status(200).type('text/plain').send(typeof challenge === 'string' ? challenge : '');
    return;
  }

  res.sendStatus(403);
});

// ── POST /api/integrations/whatsapp/webhook ───────────────────────────────────
// Inbound messages. req.body is a Buffer (scoped express.raw). We verify the HMAC
// over those exact bytes, then parse, ACK 200 fast, and process out-of-band.
router.post('/webhook', (req: Request, res: Response) => {
  // express.raw gives a Buffer; if any other parser ran, normalize defensively.
  const rawBody: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

  const signature = req.header('x-hub-signature-256');
  if (!verifySignature(rawBody, signature)) {
    // Fail closed — no logging of untrusted payloads.
    res.sendStatus(401);
    return;
  }

  // Parse AFTER signature verification. A malformed-but-signed body is acked 200
  // (don't make Meta retry a permanently-bad payload).
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as MetaWebhookPayload;
  } catch {
    console.error('[whatsapp] POST /webhook: signed payload was not valid JSON');
    res.sendStatus(200);
    return;
  }

  // ACK immediately; process asynchronously. Meta retries on slow/failed acks, so
  // processing latency/errors must never block or change the 200.
  res.sendStatus(200);

  void processInbound(payload)
    .then(summary => {
      console.log('[whatsapp] inbound processed:', JSON.stringify(summary));
    })
    .catch(err => {
      console.error('[whatsapp] inbound processing failed:', err instanceof Error ? err.message : err);
    });
});

export default router;
