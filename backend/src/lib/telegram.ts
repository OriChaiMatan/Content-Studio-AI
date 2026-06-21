// ─────────────────────────────────────────────────────────────────────────────
// Telegram Bot API configuration (Phase 2 of Telegram ingestion)
//
// Mirrors whatsapp.ts: env is read ONCE into a frozen const. MUST default to
// disabled — Telegram is opt-in. With TELEGRAM_ENABLED=false the webhook still
// verifies the secret header and dedupes/parses updates (testable), but NEVER
// sends an outbound message.
//
// Webhook trust: Telegram includes the X-Telegram-Bot-Api-Secret-Token header
// (set via setWebhook secret_token). We compare it to TELEGRAM_WEBHOOK_SECRET and
// FAIL CLOSED if no secret is configured or the header doesn't match.
// ─────────────────────────────────────────────────────────────────────────────

export const telegramConfig = {
  // Master switch. Gates all outbound sending.
  enabled: process.env.TELEGRAM_ENABLED === 'true',

  // Bot token from BotFather (also identifies the bot in the API URL).
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',

  // Shared secret echoed by Telegram in the X-Telegram-Bot-Api-Secret-Token header.
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',

  // Telegram Bot API base (overridable for self-hosted/local-bot-api setups).
  apiBase: process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org',

  // Bot @username (without the @) — used to build the t.me/<bot>?start=<token>
  // deep link returned by the account-linking endpoint.
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',

  // Base URL for building deep links into the app (shared with WhatsApp).
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
} as const;

// True only when the credential needed to SEND is present.
export function isTelegramConfigured(): boolean {
  return telegramConfig.botToken.length > 0;
}

// Product messages may send only when Telegram is enabled and configured. In dev
// (no token) this is false → sends are skipped (intent logged), ingestion still runs.
export function canSendTelegram(): boolean {
  return telegramConfig.enabled && isTelegramConfigured();
}

// Webhook secret verification — FAIL CLOSED. Returns false when no secret is
// configured or the header is missing/mismatched.
export function verifyTelegramSecret(headerValue: string | undefined): boolean {
  const secret = telegramConfig.webhookSecret;
  if (secret.length === 0) return false;
  return typeof headerValue === 'string' && headerValue === secret;
}

// ── Startup diagnostic ────────────────────────────────────────────────────────
// NEVER prints secrets — only presence.
console.log(
  '[telegram] startup config:',
  JSON.stringify({
    TELEGRAM_ENABLED_raw: process.env.TELEGRAM_ENABLED ?? '(unset)',
    enabledResolved: telegramConfig.enabled,
    botTokenPresent: telegramConfig.botToken.length > 0,
    webhookSecretPresent: telegramConfig.webhookSecret.length > 0,
    botUsernamePresent: telegramConfig.botUsername.length > 0,
    apiBase: telegramConfig.apiBase,
    configured: isTelegramConfigured(),
    canSend: canSendTelegram(),
  }),
);
