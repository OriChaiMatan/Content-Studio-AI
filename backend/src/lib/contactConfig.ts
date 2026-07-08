// ─────────────────────────────────────────────────────────────────────────────
// Contact form configuration. Mirrors the lib/*Config pattern used elsewhere
// (emailConfig, visualConfig). The destination address is the ONLY thing this
// reads — never hardcode an email address at a call site; read it from here.
// ─────────────────────────────────────────────────────────────────────────────

export const contactConfig = {
  // Where contact-form submissions are delivered. Required — the route returns
  // a clear error when this is unset rather than silently dropping messages.
  toEmail: process.env.CONTACT_TO_EMAIL ?? '',
  get enabled(): boolean {
    return this.toEmail.length > 0;
  },
} as const;
