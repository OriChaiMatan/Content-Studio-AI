import { prisma } from '../lib/prisma';
import { whatsappConfig } from '../lib/whatsapp';
import { channelSend, type Channel, type MessageKind } from '../lib/channelSend';

// ─────────────────────────────────────────────────────────────────────────────
// Review-ready completion notification (Phase 13E → Phase 4 multi-channel)
//
// Product event = "Review Ready", not "Generation Finished". Notify the case owner
// only when there is something meaningful to review:
//   1. the current run completed successfully
//   2. the case became in_review
//   3. the CURRENT run produced >= 1 output  (scoped to runId, not the whole case)
// Degraded outputs still count — every generated output is a reviewable draft.
//
// Delivery is channel-agnostic: notifyUser() fans the SAME message out to every
// linked + verified messaging channel (WhatsApp and/or Telegram). The
// notifGenerationComplete user preference gates the whole notification; per-channel
// eligibility (verified, not opted out) is enforced inside notifyUser.
//
// Best-effort and self-contained: reads committed state, NEVER throws into the
// caller, never affects the pipeline. Called detached (fire-and-forget) from
// pipelineService after the content_creation transaction commits.
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewReadyResult = { sent: boolean; reason: string };

function reviewLink(caseId: string): string {
  return `${whatsappConfig.appBaseUrl}/cases/${caseId}/review`;
}

function buildMessage(title: string, caseId: string): string {
  return `New content for "${title}" is ready for review.\n\nReview now:\n${reviewLink(caseId)}`;
}

// ── Channel-agnostic dispatcher ───────────────────────────────────────────────
// Sends `message` to EVERY linked + verified channel for the user. One channel's
// failure never blocks another (sends run concurrently; channelSend never throws).
// Returns which channels were attempted and which succeeded. Never throws.
export async function notifyUser(
  userId: string,
  message: string,
  kind: MessageKind,
): Promise<{ attempted: Channel[]; succeeded: Channel[] }> {
  const targets: { channel: Channel; externalId: string }[] = [];

  try {
    const [wa, tg] = await Promise.all([
      prisma.whatsAppIdentity.findUnique({
        where:  { userId },
        select: { phoneE164: true, verified: true, optOut: true },
      }),
      prisma.telegramIdentity.findUnique({
        where:  { userId },
        select: { chatId: true, verified: true },
      }),
    ]);

    // WhatsApp: verified and not opted out (unchanged eligibility).
    if (wa?.verified && !wa.optOut) {
      targets.push({ channel: 'whatsapp', externalId: wa.phoneE164 });
    }
    // Telegram: verified and bound to a chat id (no opt-out field yet).
    if (tg?.verified && tg.chatId) {
      targets.push({ channel: 'telegram', externalId: tg.chatId });
    }
  } catch (err) {
    console.error('[notify] notifyUser lookup error', err instanceof Error ? err.message : err);
    return { attempted: [], succeeded: [] };
  }

  const attempted = targets.map(t => t.channel);
  const succeeded: Channel[] = [];

  // Concurrent + isolated: channelSend never throws, but guard defensively so one
  // channel's failure can never block the other.
  await Promise.all(
    targets.map(async t => {
      const ok = await channelSend(t.channel, t.externalId, message, kind).catch(() => false);
      if (ok) succeeded.push(t.channel);
    }),
  );

  console.log(`[notify] user=${userId} attempted=[${attempted.join(',')}] succeeded=[${succeeded.join(',')}]`);
  return { attempted, succeeded };
}

export const notificationService = {
  async onReviewReady(caseId: string, runId: string): Promise<ReviewReadyResult> {
    try {
      // 1. Run completed successfully.
      const run = await prisma.pipelineRun.findUnique({ where: { id: runId }, select: { status: true } });
      if (!run || run.status !== 'completed') return { sent: false, reason: 'run_not_completed' };

      // 2. Case is in_review + owner preference data.
      const caseRecord = await prisma.contentCase.findUnique({
        where:  { id: caseId },
        select: {
          status: true,
          title:  true,
          userId: true,
          user:   { select: { notifGenerationComplete: true } },
        },
      });
      if (!caseRecord || caseRecord.status !== 'in_review') return { sent: false, reason: 'case_not_in_review' };

      // 3. The CURRENT run produced >= 1 output (scoped to this run, not the case).
      const outputCount = await prisma.contentOutput.count({ where: { pipelineRunId: runId } });
      if (outputCount === 0) return { sent: false, reason: 'no_outputs' };

      // 4. User preference gates the whole notification (both channels).
      if (!caseRecord.user.notifGenerationComplete) return { sent: false, reason: 'notif_disabled' };

      // Eligible — fan out to every linked + verified channel. Same text everywhere.
      const message = buildMessage(caseRecord.title, caseId);
      const { attempted, succeeded } = await notifyUser(caseRecord.userId, message, 'notification');

      if (attempted.length === 0) return { sent: false, reason: 'no_channel' };
      return { sent: succeeded.length > 0, reason: succeeded.length > 0 ? 'sent' : 'logged_intent' };
    } catch (err) {
      // Best-effort: never throw into the pipeline.
      console.error('[notify] onReviewReady error', err instanceof Error ? err.message : err);
      return { sent: false, reason: 'error' };
    }
  },
};
