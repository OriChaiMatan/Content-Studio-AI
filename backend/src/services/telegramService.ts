import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { telegramConfig } from '../lib/telegram';
import { sendTelegram } from '../lib/telegramSend';
import { ingest } from './ingestionService';

// ─────────────────────────────────────────────────────────────────────────────
// Telegram inbound processing (Phase 2 — transport only).
//
// Parses a Telegram Update, dedupes on update_id, and — for a PRIVATE 1:1 TEXT
// message from a non-bot — resolves the sender to a verified TelegramIdentity and
// hands off to the shared, channel-agnostic ingestionService.
//
// Phase 2 has no /start binding yet, so no verified identities exist → every
// inbound user gets a clear onboarding-required reply. The verified → ingest path
// is wired so a later phase only needs to add the binding.
//
// Out of scope (silently ignored): groups/channels, photos/documents/audio, edited
// messages, callbacks, bots. Never throws (called fire-and-forget by the route).
// ─────────────────────────────────────────────────────────────────────────────

interface TelegramUser {
  id?: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
}
interface TelegramChat {
  id?: number;
  type?: string;   // 'private' | 'group' | 'supergroup' | 'channel'
}
interface TelegramMessage {
  message_id?: number;
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
}
export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
}

export type TelegramProcessResult =
  | 'ignored'              // not a private text message we handle
  | 'duplicate'            // update_id already processed
  | 'onboarding_required'  // sender has no verified Telegram identity
  | 'linked'               // /start token bound this Telegram account
  | 'link_failed'          // /start token invalid / expired / already-linked elsewhere
  | 'ingested'             // handed to the shared ingestion service
  | 'ingest_noop';         // ingestion ran but added nothing (e.g. no active case)

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;   // 10 minutes

const ONBOARDING_MESSAGE =
  'Your Telegram isn’t linked to a Content Studio account yet. ' +
  `Open the app to connect Telegram, then send your links and notes here:\n${telegramConfig.appBaseUrl}`;

// ── Account linking (deep-link token flow) ────────────────────────────────────

// Create/refresh a single-use, 10-minute link token for the app user and return
// the t.me deep link. Does NOT overwrite an already-verified link.
export async function createLinkToken(userId: string): Promise<
  | { ok: true; linkUrl: string; expiresAt: string }
  | { ok: false; reason: 'already_linked' }
> {
  const existing = await prisma.telegramIdentity.findUnique({ where: { userId } });
  if (existing?.verified) return { ok: false, reason: 'already_linked' };

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

  // Upsert the user's (unverified) identity row carrying the pending token. The
  // Telegram user id stays null until /start binds it.
  await prisma.telegramIdentity.upsert({
    where:  { userId },
    create: { userId, verifyToken: token, verifyExpires: expiresAt, verified: false },
    update: { verifyToken: token, verifyExpires: expiresAt },
  });

  const linkUrl = `https://t.me/${telegramConfig.botUsername}?start=${token}`;
  return { ok: true, linkUrl, expiresAt: expiresAt.toISOString() };
}

export async function getLinkStatus(userId: string): Promise<{ connected: boolean; username: string | null }> {
  const id = await prisma.telegramIdentity.findUnique({ where: { userId } });
  return { connected: !!id?.verified, username: id?.verified ? (id.username ?? null) : null };
}

interface TgSender {
  telegramUserId: string;
  chatId: string;
  username?: string;
  displayName?: string;
}

// /start [token] — bind this Telegram account to the app user who minted the token.
async function handleStart(token: string | null, tg: TgSender): Promise<TelegramProcessResult> {
  if (!token) {
    await sendTelegram(tg.chatId,
      'To connect your account, open Settings in the app and tap “Connect Telegram”, then tap the link it gives you.');
    return 'onboarding_required';
  }

  // Look up the pending token. Single-use: it's cleared on success below.
  const identity = await prisma.telegramIdentity.findFirst({ where: { verifyToken: token } });
  if (!identity || !identity.verifyExpires || identity.verifyExpires.getTime() < Date.now()) {
    await sendTelegram(tg.chatId,
      'That link is invalid or has expired. Open Settings in the app and tap “Connect Telegram” to get a fresh link.');
    return 'link_failed';
  }

  // Never allow takeover: if this Telegram account is already verified for a
  // DIFFERENT app user, refuse to rebind.
  const existingForTg = await prisma.telegramIdentity.findUnique({ where: { telegramUserId: tg.telegramUserId } });
  if (existingForTg && existingForTg.verified && existingForTg.userId !== identity.userId) {
    await sendTelegram(tg.chatId, 'This Telegram account is already linked to another Content Studio account.');
    return 'link_failed';
  }

  try {
    await prisma.telegramIdentity.update({
      where: { id: identity.id },
      data: {
        telegramUserId: tg.telegramUserId,
        chatId:         tg.chatId,
        username:       tg.username ?? null,
        displayName:    tg.displayName ?? null,
        verified:       true,
        verifyToken:    null,   // single-use — consumed
        verifyExpires:  null,
      },
    });
  } catch (err) {
    // Unique collision on telegramUserId (race) → treat as already-linked elsewhere.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await sendTelegram(tg.chatId, 'This Telegram account is already linked to another Content Studio account.');
      return 'link_failed';
    }
    throw err;
  }

  await sendTelegram(tg.chatId,
    '✅ Your Telegram is now linked. Send me an article link or some notes and I’ll add it to your active case.');
  return 'linked';
}

// Idempotency: insert a dedup row; a P2002 means this update_id was already seen.
async function isNewUpdate(updateId: number): Promise<boolean> {
  try {
    await prisma.channelInboundDedup.create({
      data: { channel: 'telegram', externalId: String(updateId) },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false;   // duplicate update — already processed
    }
    throw err;
  }
}

export async function processUpdate(update: TelegramUpdate): Promise<TelegramProcessResult> {
  // No update_id → nothing we can dedupe/process safely.
  if (typeof update.update_id !== 'number') return 'ignored';

  // Dedupe FIRST so Telegram retries are no-ops (no double ingestion).
  const isNew = await isNewUpdate(update.update_id);
  if (!isNew) return 'duplicate';

  const msg = update.message;

  // Scope: PRIVATE 1:1 TEXT messages from a real (non-bot) user only.
  if (
    !msg ||
    msg.chat?.type !== 'private' ||
    typeof msg.text !== 'string' ||
    typeof msg.from?.id !== 'number' ||
    msg.from.is_bot === true ||
    typeof msg.chat?.id !== 'number'
  ) {
    return 'ignored';
  }

  const text = msg.text.trim();
  const tg: TgSender = {
    telegramUserId: String(msg.from.id),
    chatId:         String(msg.chat.id),
    username:       msg.from.username,
    displayName:    [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || undefined,
  };

  // /start [token] → account-linking deep link (Phase 3).
  const startMatch = text.match(/^\/start(?:\s+(\S+))?$/);
  if (startMatch) {
    return handleStart(startMatch[1] ?? null, tg);
  }

  // Normal message → resolve a VERIFIED identity for this Telegram user.
  const identity = await prisma.telegramIdentity.findUnique({ where: { telegramUserId: tg.telegramUserId } });
  if (!identity || !identity.verified) {
    await sendTelegram(tg.chatId, ONBOARDING_MESSAGE);
    return 'onboarding_required';
  }

  // Verified → shared, channel-agnostic ingestion (replies via channelSend).
  const result = await ingest(
    { userId: identity.userId, channel: 'telegram', externalId: tg.chatId },
    { type: 'text', body: text },
  );
  return result.ingested ? 'ingested' : 'ingest_noop';
}
