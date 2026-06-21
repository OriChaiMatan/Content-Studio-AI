import { telegramConfig, canSendTelegram } from './telegram';

// ─────────────────────────────────────────────────────────────────────────────
// Telegram outbound send (Phase 2).
//
// Leaf module: depends only on telegram config. The Telegram transport behind
// channelSend. Must NOT import any service. NEVER throws — a send failure must
// never turn a webhook ACK into a non-200; logs and returns false instead.
//
// Gated on canSendTelegram(): in dev / when disabled, the intended message is
// logged and the call returns false (ingestion still proceeds).
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTelegram(chatId: string, body: string): Promise<boolean> {
  if (!canSendTelegram()) {
    console.log(`[telegram] send skipped (disabled/unconfigured) → chat ${chatId}: ${body.slice(0, 80)}`);
    return false;
  }

  const url = `${telegramConfig.apiBase}/bot${telegramConfig.botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[telegram] send failed: ${res.status} ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] send error:', err instanceof Error ? err.message : err);
    return false;
  }
}
