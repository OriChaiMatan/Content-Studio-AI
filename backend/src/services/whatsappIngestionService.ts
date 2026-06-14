import type { WhatsAppIdentity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { whatsappConfig } from '../lib/whatsapp';
import { reply } from '../lib/whatsappSend';
import { sourceService } from './sourceService';

// Minimal inbound shape this service needs. Defined locally (structurally compatible
// with whatsappService's InboundMessage) so ingestion does NOT import whatsappService —
// keeping the dependency one-way: whatsappService → whatsappIngestionService.
export interface IngestInbound {
  from: string;
  type: string;
  body: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp source ingestion (Phase 13C)
//
// A VERIFIED sender's text/URL message becomes a ContentSource on their single
// active case. Strictly:
//   - verified sender only (caller guarantees this)
//   - exactly ONE active case → add source + confirm
//   - zero active cases       → notice, no source, no case created
//   - multiple active cases   → notice, no source (selection is Phase 13D)
//
// NEVER triggers the pipeline or content generation. addSource runs the existing
// source-intelligence analysis (parity with the web app) but nothing more.
// ─────────────────────────────────────────────────────────────────────────────

// Active = anything that is not a terminal/completed case. Matches the 13C set
// (draft, research, fact_check, generating, in_review). Using NOT completed keeps
// it correct if a new non-terminal status is ever added.
async function findActiveCases(userId: string) {
  return prisma.contentCase.findMany({
    where:   { userId, status: { not: 'completed' } },
    orderBy: { updatedAt: 'desc' },
    select:  { id: true, title: true },
  });
}

// 13C URL rule: classify as 'url' ONLY when the entire trimmed message is a single
// http/https URL token. Mixed text-with-URL and bare domains are plain text.
const SINGLE_URL_RE = /^https?:\/\/\S+$/i;

function classify(body: string): { type: 'text' | 'url'; content: string; label: string } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;   // empty/whitespace → nothing to ingest
  if (SINGLE_URL_RE.test(trimmed)) {
    return { type: 'url', content: trimmed, label: 'WhatsApp link' };
  }
  return { type: 'text', content: trimmed, label: 'WhatsApp message' };
}

function caseLink(caseId: string): string {
  return `${whatsappConfig.appBaseUrl}/cases/${caseId}`;
}

export interface IngestResult {
  ingested: boolean;
  reason: 'added' | 'no_active_cases' | 'multiple_active_cases' | 'unsupported' | 'case_unavailable';
}

// Entry point — called by processInbound for a VERIFIED identity.
export async function ingestFromWhatsapp(identity: WhatsAppIdentity, msg: IngestInbound): Promise<IngestResult> {
  // Non-text (image/pdf/voice/…) is out of scope for 13C.
  if (msg.type !== 'text') {
    await reply(identity.phoneE164, 'I can only accept text messages and links right now.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  const classified = classify(msg.body);
  if (!classified) {
    await reply(identity.phoneE164, 'Send a link or some text to add it as a source.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  const activeCases = await findActiveCases(identity.userId);

  // Zero active cases → no source, no case creation (scope).
  if (activeCases.length === 0) {
    await reply(
      identity.phoneE164,
      `You have no active cases. Create or open one in the app: ${whatsappConfig.appBaseUrl}`,
      'notice',
    );
    return { ingested: false, reason: 'no_active_cases' };
  }

  // Multiple active cases → no auto-select (selection is Phase 13D).
  if (activeCases.length > 1) {
    await reply(
      identity.phoneE164,
      `You have multiple active cases. Open the app to choose where this goes: ${whatsappConfig.appBaseUrl}`,
      'notice',
    );
    return { ingested: false, reason: 'multiple_active_cases' };
  }

  // Exactly one active case → add the source. The case was selected via
  // where:{ userId }, so ownership holds by construction — we only ever write to
  // the sender's own case.
  const target = activeCases[0];
  const source = await sourceService.addSource(target.id, {
    type:    classified.type,
    label:   classified.label,
    content: classified.content,
  });

  if (!source) {
    // Case vanished between the lookup and the write.
    await reply(identity.phoneE164, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  await reply(
    identity.phoneE164,
    `✓ Added to "${target.title}". Review it here: ${caseLink(target.id)}`,
    'confirmation',
  );
  return { ingested: true, reason: 'added' };
}
