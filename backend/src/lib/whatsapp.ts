// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API configuration (Phase 13A)
//
// Mirrors the sourceAnalysisConfig pattern in anthropic.ts: env is read ONCE into
// a frozen const so the rest of the app sees a stable, typed config object.
//
// MUST default to disabled — WhatsApp is opt-in. With WHATSAPP_ENABLED=false the
// webhook still verifies signatures and logs inbound messages (so the plumbing is
// testable), but NEVER sends an outbound message. The GET verification handshake
// always works regardless of the flag, because the webhook must be registerable
// with Meta before the feature is switched on.
// ─────────────────────────────────────────────────────────────────────────────

export const whatsappConfig = {
  // Master switch. Gates all outbound sending and (in later phases) ingestion.
  enabled: process.env.WHATSAPP_ENABLED === 'true',

  // 13A echo helper switch. Echo may only ever send when enabled && echoEnabled &&
  // configured && the request signature was valid (see whatsappService).
  echoEnabled: process.env.WHATSAPP_ECHO_ENABLED === 'true',

  // GET handshake shared secret (hub.verify_token) chosen when registering the webhook.
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',

  // HMAC key for X-Hub-Signature-256 verification of inbound POSTs.
  appSecret: process.env.WHATSAPP_APP_SECRET ?? '',

  // Outbound: bearer token + sender phone-number id + graph API version.
  token: process.env.WHATSAPP_TOKEN ?? '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',

  // Base URL for building deep links into the app. Declared now (used by later
  // phases for case/review links); unused in 13A.
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
} as const;

// True only when every credential needed to SEND an outbound message is present.
// Outbound is hard-gated on this so a partially-configured deployment never tries
// to call the Graph API with a missing token/phone id.
export function isWhatsappConfigured(): boolean {
  return (
    whatsappConfig.appSecret.length > 0 &&
    whatsappConfig.token.length > 0 &&
    whatsappConfig.phoneNumberId.length > 0
  );
}

// Echo (13A) may send only when ALL conditions hold. Centralized so the route and
// service share one definition.
export function canEcho(): boolean {
  return whatsappConfig.enabled && whatsappConfig.echoEnabled && isWhatsappConfigured();
}

// ── Startup diagnostic (Phase 13A) ───────────────────────────────────────────
// Reports resolved config so we can confirm what the running process loaded.
// NEVER prints secrets — only presence/length.
console.log(
  '[whatsapp] startup config:',
  JSON.stringify({
    WHATSAPP_ENABLED_raw: process.env.WHATSAPP_ENABLED ?? '(unset)',
    enabledResolved: whatsappConfig.enabled,
    echoEnabledResolved: whatsappConfig.echoEnabled,
    verifyTokenPresent: whatsappConfig.verifyToken.length > 0,
    appSecretPresent: whatsappConfig.appSecret.length > 0,
    tokenPresent: whatsappConfig.token.length > 0,
    phoneNumberIdPresent: whatsappConfig.phoneNumberId.length > 0,
    apiVersion: whatsappConfig.apiVersion,
    configured: isWhatsappConfigured(),
    canEcho: canEcho(),
  }),
);
