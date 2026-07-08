import { Resend } from 'resend';
import { emailConfig } from '../lib/emailConfig';

// ─────────────────────────────────────────────────────────────────────────────
// EmailService — a thin, testable abstraction over the transactional email
// provider (Resend). One generic `send()` plus typed helpers per template, so new
// emails (welcome, receipts, …) are added without touching call sites.
//
// Safe by default: with no RESEND_API_KEY the service is a no-op that reports
// `sent: false` (the caller still returns its normal response — enumeration-safe).
// It NEVER logs tokens or reset URLs.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Set on notification emails (e.g. contact form) so the recipient can hit
  // "reply" in their client and land in the submitter's inbox directly.
  replyTo?: string;
}
export type SendResult = { sent: true; id: string | null } | { sent: false; reason: 'disabled' | 'error' };

let client: Resend | null = null;
function resend(): Resend | null {
  if (!emailConfig.enabled) return null;
  if (!client) client = new Resend(emailConfig.resendApiKey);
  return client;
}

// Minimal HTML entity escaping for values interpolated into templates (name, etc.).
// The reset URL is our own origin + a base64url token, so it needs no escaping, but
// we still avoid inserting untrusted strings unescaped.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function send(input: SendEmailInput): Promise<SendResult> {
  const r = resend();
  if (!r) {
    // Dev-only escape hatch: opt-in, never on in production, so local testing without
    // a Resend key is possible. This DOES print the URL — hence the explicit flag.
    if (process.env.EMAIL_DEBUG === '1' && process.env.NODE_ENV !== 'production') {
      console.warn(`[emailService] (EMAIL_DEBUG) would send "${input.subject}" to ${input.to}`);
    }
    return { sent: false, reason: 'disabled' };
  }
  try {
    const { data } = await r.emails.send({
      from: emailConfig.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    // Log the failure WITHOUT any token/URL content.
    console.error('[emailService] send failed:', err instanceof Error ? err.message : 'unknown error');
    return { sent: false, reason: 'error' };
  }
}

// ── Password reset template ───────────────────────────────────────────────────
export interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}

const BRAND = '#094CB2';
const INK = '#111827';
const MUTED = '#6b7280';

// Rendered separately (and exported) so it can be unit-tested / previewed without
// touching the provider. Table-based, fully inline-styled for email-client support.
export function renderPasswordResetEmail(input: PasswordResetEmailInput): { html: string; text: string; subject: string } {
  const name = esc(input.name || 'there');
  const url = input.resetUrl;
  const mins = input.expiresMinutes;
  const subject = 'Reset your LumAI password';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:28px 32px 8px;">
          <span style="display:inline-block;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${BRAND};">LumAI</span>
          <span style="display:block;font-size:11px;color:${MUTED};letter-spacing:0.04em;margin-top:2px;">Content Intelligence Engine</span>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${INK};font-weight:800;letter-spacing:-0.01em;">Reset your password</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${INK};">Hi ${name},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">
            We received a request to reset the password for your LumAI account. Click the button below to choose a new password.
          </p>
        </td></tr>
        <tr><td style="padding:4px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND};">
            <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Reset password</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${MUTED};">Or paste this link into your browser:</p>
          <p style="margin:0 0 18px;font-size:13px;line-height:1.5;word-break:break-all;">
            <a href="${url}" target="_blank" style="color:${BRAND};text-decoration:underline;">${esc(url)}</a>
          </p>
          <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${MUTED};">
            This link expires in <strong style="color:${INK};">${mins} minutes</strong> and can be used once.
          </p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${MUTED};">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;border-top:1px solid #f0f1f3;">
          <p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">© ${new Date().getFullYear()} LumAI · This is an automated message, please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Reset your LumAI password`,
    ``,
    `Hi ${input.name || 'there'},`,
    ``,
    `We received a request to reset the password for your LumAI account.`,
    `Open this link to choose a new password:`,
    ``,
    url,
    ``,
    `This link expires in ${mins} minutes and can be used once.`,
    `If you didn't request this, you can safely ignore this email.`,
    ``,
    `© ${new Date().getFullYear()} LumAI`,
  ].join('\n');

  return { html, text, subject };
}

// ── Contact form notification ─────────────────────────────────────────────────
export interface ContactMessageEmailInput {
  to: string;
  name: string;
  email: string;
  message: string;
}

// Rendered separately (and exported) so it's testable/previewable without touching
// the provider — same rationale as renderPasswordResetEmail above.
export function renderContactMessageEmail(input: ContactMessageEmailInput): { html: string; text: string; subject: string } {
  const name = esc(input.name);
  const email = esc(input.email);
  const message = esc(input.message).replace(/\n/g, '<br>');
  const subject = `New contact form message from ${input.name}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:28px 32px 8px;">
          <span style="display:inline-block;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${BRAND};">LumAI</span>
          <span style="display:block;font-size:11px;color:${MUTED};letter-spacing:0.04em;margin-top:2px;">Marketing site — Contact form</span>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${INK};font-weight:800;letter-spacing:-0.01em;">New contact message</h1>
          <p style="margin:0 0 4px;font-size:13px;color:${MUTED};">From</p>
          <p style="margin:0 0 16px;font-size:15px;color:${INK};">${name} &lt;${email}&gt;</p>
          <p style="margin:0 0 4px;font-size:13px;color:${MUTED};">Message</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${message}</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;border-top:1px solid #f0f1f3;">
          <p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">Reply to this email to respond directly to ${email}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `New contact form message`,
    ``,
    `From: ${input.name} <${input.email}>`,
    ``,
    input.message,
    ``,
    `Reply to this email to respond directly to ${input.email}.`,
  ].join('\n');

  return { html, text, subject };
}

export const emailService = {
  send,
  async sendPasswordReset(input: PasswordResetEmailInput): Promise<SendResult> {
    const { html, text, subject } = renderPasswordResetEmail(input);
    return send({ to: input.to, subject, html, text });
  },
  async sendContactMessage(input: ContactMessageEmailInput): Promise<SendResult> {
    const { html, text, subject } = renderContactMessageEmail(input);
    return send({ to: input.to, subject, html, text, replyTo: input.email });
  },
};
