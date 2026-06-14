import { prisma } from './prisma';
import { whatsappConfig, canSend } from './whatsapp';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp outbound send (Phase 13C extraction)
//
// Leaf module: depends only on prisma + whatsapp config. It is imported by both
// whatsappService (echo / verification replies) and whatsappIngestionService
// (confirmations / notices) so neither imports the other — breaking the prior
// whatsappService ⇄ whatsappIngestionService cycle. This module must NOT import
// either of those services.
//
// Behavior is unchanged from the previous in-service implementation.
// ─────────────────────────────────────────────────────────────────────────────

// Outbound row classification. 13A echo, errors, 13C product messages, and the
// 13E review-ready notification (logged distinctly).
export type OutboundKind = 'echo' | 'error' | 'confirmation' | 'notice' | 'notification';

// Outbound rows carry no waMessageId (we don't track Meta's returned id in 13A).
async function logOutbound(to: string, body: string, kind: OutboundKind): Promise<void> {
  await prisma.whatsAppMessage.create({
    data: { phoneE164: to, direction: 'outbound', kind, body },
  });
}

// ── Outbound send (gated) ─────────────────────────────────────────────────────
// Sends a plain-text WhatsApp message via the Graph API. Caller MUST gate on
// canEcho()/canSend() — this function does not re-check the feature flag, only that
// it has somewhere to send. Never throws: logs and returns false on failure so a
// send error can never turn the webhook ack into a non-200.
export async function sendText(to: string, body: string, kind: OutboundKind = 'echo'): Promise<boolean> {
  const url = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${whatsappConfig.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappConfig.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[whatsapp] send failed: ${res.status} ${detail.slice(0, 300)}`);
      await logOutbound(to, body, 'error').catch(() => {});
      return false;
    }
    await logOutbound(to, body, kind).catch(() => {});
    return true;
  } catch (err) {
    console.error('[whatsapp] send error:', err instanceof Error ? err.message : err);
    await logOutbound(to, body, 'error').catch(() => {});
    return false;
  }
}

// Phase 13C — product reply: send when canSend(), otherwise just log the intended
// message (so dev without credentials still records the decision). Returns whether
// it was actually delivered.
export async function reply(to: string, body: string, kind: 'confirmation' | 'notice' | 'notification'): Promise<boolean> {
  if (canSend()) return sendText(to, body, kind);
  await logOutbound(to, body, kind).catch(() => {});
  return false;
}
