import { reply } from './whatsappSend';
import { sendTelegram } from './telegramSend';

// ─────────────────────────────────────────────────────────────────────────────
// Channel-agnostic outbound dispatcher.
//
// The shared ingestion service replies via channelSend(channel, externalId, …)
// instead of a WhatsApp-specific reply(). Phase 1 supports WhatsApp only; the
// Telegram transport is added in a later phase by extending the switch.
//
// Never throws (parity with the underlying reply()): a send failure must never
// turn a webhook ACK into a non-200.
// ─────────────────────────────────────────────────────────────────────────────

export type Channel = 'whatsapp' | 'telegram';

// Product-message kinds (mirrors whatsappSend.reply()'s gated kinds).
export type MessageKind = 'confirmation' | 'notice' | 'notification';

export async function channelSend(
  channel: Channel,
  externalId: string,
  body: string,
  kind: MessageKind,
): Promise<boolean> {
  switch (channel) {
    case 'whatsapp':
      return reply(externalId, body, kind);
    case 'telegram':
      // Telegram has no per-kind logging table; kind is intentionally unused.
      return sendTelegram(externalId, body);
    default:
      console.warn(`[channelSend] no transport for channel "${channel}" — message not sent`);
      return false;
  }
}
