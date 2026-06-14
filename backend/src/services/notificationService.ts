import { prisma } from '../lib/prisma';
import { whatsappConfig } from '../lib/whatsapp';
import { reply } from '../lib/whatsappSend';

// ─────────────────────────────────────────────────────────────────────────────
// Review-ready WhatsApp notification (Phase 13E)
//
// Product event = "Review Ready", not "Generation Finished". Notify the case owner
// only when there is something meaningful to review:
//   1. the current run completed successfully
//   2. the case became in_review
//   3. the CURRENT run produced >= 1 output  (scoped to runId, not the whole case)
// Degraded outputs still count — every generated output is a reviewable draft.
//
// Eligibility (ALL required, else skip silently):
//   - a WhatsAppIdentity exists
//   - identity.verified === true
//   - identity.optOut === false
//   - user.notifGenerationComplete === true
// Transmission is additionally gated by canSend() inside reply(): when WhatsApp is
// enabled + configured it sends (logged 'notification'); otherwise the intent is
// logged as 'notification' without transmitting.
//
// Best-effort and self-contained: reads committed state, never throws into the
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

export const notificationService = {
  async onReviewReady(caseId: string, runId: string): Promise<ReviewReadyResult> {
    try {
      // 1. Run completed successfully.
      const run = await prisma.pipelineRun.findUnique({ where: { id: runId }, select: { status: true } });
      if (!run || run.status !== 'completed') return { sent: false, reason: 'run_not_completed' };

      // 2. Case is in_review + 4. owner eligibility data.
      const caseRecord = await prisma.contentCase.findUnique({
        where:  { id: caseId },
        select: {
          status: true,
          title:  true,
          user: {
            select: {
              notifGenerationComplete: true,
              whatsappIdentity: { select: { phoneE164: true, verified: true, optOut: true } },
            },
          },
        },
      });
      if (!caseRecord || caseRecord.status !== 'in_review') return { sent: false, reason: 'case_not_in_review' };

      // 3. The CURRENT run produced >= 1 output (scoped to this run, not the case).
      const outputCount = await prisma.contentOutput.count({ where: { pipelineRunId: runId } });
      if (outputCount === 0) return { sent: false, reason: 'no_outputs' };

      // 4. Eligibility — ALL must hold, else skip silently.
      const identity = caseRecord.user.whatsappIdentity;
      if (!identity)                              return { sent: false, reason: 'no_identity' };
      if (!identity.verified)                     return { sent: false, reason: 'not_verified' };
      if (identity.optOut)                        return { sent: false, reason: 'opted_out' };
      if (!caseRecord.user.notifGenerationComplete) return { sent: false, reason: 'notif_disabled' };

      // Eligible — send (or log intent when canSend() is false, inside reply()).
      const sent = await reply(identity.phoneE164, buildMessage(caseRecord.title, caseId), 'notification');
      return { sent, reason: sent ? 'sent' : 'logged_intent' };
    } catch (err) {
      // Best-effort: never throw into the pipeline.
      console.error('[notify] onReviewReady error', err instanceof Error ? err.message : err);
      return { sent: false, reason: 'error' };
    }
  },
};
