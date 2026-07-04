// ─────────────────────────────────────────────────────────────────────────────
// Email configuration (Resend). Mirrors the lib/*Config pattern used elsewhere
// (visualConfig, whatsapp). Reads env once at import; `enabled` gates real sends so
// the app boots and behaves correctly with no key configured (e.g. local dev).
// ─────────────────────────────────────────────────────────────────────────────

export const emailConfig = {
  // Resend API key. When absent, EmailService is a safe no-op (see emailService.ts).
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  // Sender identity. Must be a Resend-verified domain in production.
  from: process.env.EMAIL_FROM || 'LumAI <no-reply@mrtrk.com>',
  // Public base URL of the SPA, used to build absolute links (e.g. reset URL).
  // Falls back to localhost in dev so links are still clickable.
  appBaseUrl: (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  // Real sends require a key.
  get enabled(): boolean {
    return this.resendApiKey.length > 0;
  },
} as const;
