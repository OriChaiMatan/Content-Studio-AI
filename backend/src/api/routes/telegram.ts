import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyTelegramSecret, telegramConfig } from '../../lib/telegram';
import { requireAuth } from '../middleware/auth';
import { processUpdate, createLinkToken, getLinkStatus, type TelegramUpdate } from '../../services/telegramService';

// ─────────────────────────────────────────────────────────────────────────────
// Telegram Bot API webhook (Phase 2 — plumbing).
//
// PUBLIC router (no requireAuth) — Telegram calls it with no cookie. Trust comes
// from the X-Telegram-Bot-Api-Secret-Token header (set via setWebhook secret_token)
// matching TELEGRAM_WEBHOOK_SECRET. FAIL CLOSED on missing/invalid secret.
//
// Mounted AFTER express.json (see app.ts) — req.body is the parsed Update. We ACK
// 200 fast and process out-of-band so processing latency/errors never make Telegram
// retry or change the ACK.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── POST /api/integrations/telegram/link-token (AUTHENTICATED) ────────────────
// Mint a single-use, 10-minute deep-link token for the signed-in user and return
// the t.me link. Does not overwrite an already-verified link (409).
router.post('/link-token', requireAuth, async (req: Request, res: Response) => {
  if (!telegramConfig.botUsername) {
    res.status(503).json({ error: 'Telegram isn’t configured on the server yet.' });
    return;
  }
  try {
    const result = await createLinkToken(req.userId!);
    if (!result.ok) {
      res.status(409).json({ error: 'Your Telegram is already connected.', alreadyLinked: true });
      return;
    }
    res.json({ linkUrl: result.linkUrl, expiresAt: result.expiresAt });
  } catch (err) {
    console.error('[telegram] link-token error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Could not create a Telegram link. Please try again.' });
  }
});

// ── GET /api/integrations/telegram/status (AUTHENTICATED) ─────────────────────
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await getLinkStatus(req.userId!));
  } catch (err) {
    console.error('[telegram] status error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Could not load Telegram status.' });
  }
});

router.post('/webhook', (req: Request, res: Response) => {
  // Verify the shared secret header — fail closed (401) on missing/mismatch.
  const headerSecret = req.header('x-telegram-bot-api-secret-token');
  if (!verifyTelegramSecret(headerSecret)) {
    res.sendStatus(401);
    return;
  }

  const update = req.body as TelegramUpdate;

  // ACK immediately; process asynchronously. Telegram retries on slow/failed acks,
  // so processing must never block or change the 200.
  res.sendStatus(200);

  void processUpdate(update)
    .then(result => {
      console.log(`[telegram] update ${update?.update_id} → ${result}`);
    })
    .catch(err => {
      console.error('[telegram] update processing failed:', err instanceof Error ? err.message : err);
    });
});

export default router;
