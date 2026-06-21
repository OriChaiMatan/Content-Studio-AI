import { Prisma, type WhatsAppIdentity, type WhatsAppPendingSource } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { whatsappConfig } from '../lib/whatsapp';
import { reply } from '../lib/whatsappSend';
import { sourceService } from './sourceService';
import { isAuthwalledHost } from './urlExtractionService';

// Minimal inbound shape this service needs. Defined locally (structurally compatible
// with whatsappService's InboundMessage) so ingestion does NOT import whatsappService —
// keeping the dependency one-way: whatsappService → whatsappIngestionService.
export interface IngestInbound {
  from: string;
  type: string;
  body: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp source ingestion (Phase 13C + 13D)
//
// A VERIFIED sender's text/URL message becomes a ContentSource. Routing by active
// case count:
//   1 active   → add source + confirm                                    (13C)
//   0 active   → notice, no source, no case created                      (13C)
//   >1 active  → hold a pending source + numbered list; a numeric reply  (13D)
//                files it into the chosen case
//
// NEVER triggers the pipeline or content generation. addSource runs the existing
// source-intelligence analysis (parity with the web app) but nothing more.
// ─────────────────────────────────────────────────────────────────────────────

const PENDING_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_CASE_OPTIONS = 9;              // numbered list cap
const TITLE_MAX = 60;                    // truncate long titles in the list

// Stored snapshot of the numbered list shown to the user.
interface CaseOption {
  index:  number;
  caseId: string;
  title:  string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Active = not completed. Matches the 13C/13D set (draft, research, fact_check,
// generating, in_review). NOT completed stays correct if a new non-terminal status
// is ever added.
async function findActiveCases(userId: string) {
  return prisma.contentCase.findMany({
    where:   { userId, status: { not: 'completed' } },
    orderBy: { updatedAt: 'desc' },
    select:  { id: true, title: true },
  });
}

// ── Pending repo (lazy expiry — no background sweeper) ─────────────────────────

function findPending(phoneE164: string): Promise<WhatsAppPendingSource | null> {
  return prisma.whatsAppPendingSource.findUnique({ where: { phoneE164 } });
}

async function upsertPending(
  identity: WhatsAppIdentity,
  data: { sourceType: 'text' | 'url'; label: string; content: string; caseOptions: CaseOption[] },
): Promise<void> {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  // mode/caseId/sourceId set explicitly so this overwrites any prior manual_text row cleanly.
  const payload = {
    mode:        'select_case',
    sourceType:  data.sourceType,
    label:       data.label,
    content:     data.content,
    caseOptions: data.caseOptions as unknown as Prisma.InputJsonValue,
    caseId:      null,
    sourceId:    null,
    expiresAt,
  };
  await prisma.whatsAppPendingSource.upsert({
    where:  { phoneE164: identity.phoneE164 },
    create: { userId: identity.userId, phoneE164: identity.phoneE164, ...payload },
    update: { userId: identity.userId, ...payload },
  });
}

// manual_text pending — a url source was created with failed/partial extraction;
// the next plain-text message recovers it. caseOptions is unused (stored as []).
async function upsertManualTextPending(
  identity: WhatsAppIdentity,
  data: { caseId: string; sourceId: string; label: string; content: string },
): Promise<void> {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  const payload = {
    mode:        'manual_text',
    sourceType:  'url',
    label:       data.label,
    content:     data.content,
    caseOptions: [] as unknown as Prisma.InputJsonValue,
    caseId:      data.caseId,
    sourceId:    data.sourceId,
    expiresAt,
  };
  await prisma.whatsAppPendingSource.upsert({
    where:  { phoneE164: identity.phoneE164 },
    create: { userId: identity.userId, phoneE164: identity.phoneE164, ...payload },
    update: { userId: identity.userId, ...payload },
  });
}

async function deletePending(phoneE164: string): Promise<void> {
  await prisma.whatsAppPendingSource.deleteMany({ where: { phoneE164 } });
}

// ── Classification & formatting ───────────────────────────────────────────────

// 13C URL rule: classify as 'url' ONLY when the entire trimmed message is a single
// http/https URL token. Mixed text-with-URL and bare domains are plain text.
const SINGLE_URL_RE = /^https?:\/\/\S+$/i;
// 13D selection: a BARE integer only. "1." / "case 1" / "1 thanks" are NOT selections.
const SELECTION_RE = /^\d+$/;

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

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function buildCaseListMessage(options: CaseOption[], totalActive: number): string {
  const lines = options.map(o => `${o.index}. ${truncate(o.title, TITLE_MAX)}`).join('\n');
  let msg = `You have multiple active cases. Reply with a number to file this:\n${lines}\n(reply within 30 minutes)`;
  if (totalActive > options.length) {
    msg += `\nShowing ${options.length} of ${totalActive}. To choose another, open the app: ${whatsappConfig.appBaseUrl}`;
  }
  return msg;
}

function confirmation(title: string, caseId: string): string {
  return `Added to "${title}".\n\nView the case:\n${caseLink(caseId)}`;
}

// URL extraction succeeded — read the link directly.
function urlSuccessMessage(title: string, caseId: string): string {
  return `I read the link and added it to "${title}".\n\nView the case:\n${caseLink(caseId)}`;
}

// URL extraction failed/partial — invite the manual-text recovery (req. 4/5).
function recoveryMessage(content: string, status: string): string {
  if (status === 'partial') {
    return 'I could only read part of this page. Send me the full post text in your next message.';
  }
  return isAuthwalledHost(content)
    ? "I couldn't read this social post automatically. Facebook/LinkedIn/X sometimes block automated reading. Send me the post text in your next message."
    : "I couldn't read this link automatically. Send me the page text in your next message.";
}

export interface IngestResult {
  ingested: boolean;
  reason:
    | 'added'
    | 'no_active_cases'
    | 'pending_created'
    | 'selection_resolved'
    | 'selection_invalid'
    | 'selection_expired'
    | 'unsupported'
    | 'case_unavailable'
    | 'manual_text_pending'      // url source saved with failed/partial extraction; awaiting pasted text
    | 'manual_text_attached'     // pasted text recovered the source
    | 'manual_text_unavailable'; // remembered source/case gone before the paste arrived
}

// ── Entry point — called by processInbound for a VERIFIED identity ─────────────
export async function ingestFromWhatsapp(identity: WhatsAppIdentity, msg: IngestInbound): Promise<IngestResult> {
  // Non-text (image/pdf/voice/…) is out of scope. Leave any pending intact (an
  // image is not a valid replacement) — just notify.
  if (msg.type !== 'text') {
    await reply(identity.phoneE164, 'I can only accept text messages and links right now.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  const body = msg.body.trim();
  let pending = await findPending(identity.phoneE164);

  // ── manual_text recovery mode ────────────────────────────────────────────────
  // A url source was created with failed/partial extraction; we're waiting for the
  // user to paste the post/page text. This branch runs BEFORE numeric-selection so a
  // pasted number is treated as text, not a case pick.
  if (pending && pending.mode === 'manual_text') {
    if (pending.expiresAt.getTime() > Date.now()) {
      return handleManualText(identity, pending, body);
    }
    // Expired → drop it and treat this message as fresh content.
    await deletePending(identity.phoneE164);
    pending = null;
  }

  // ── Numeric reply → selection (only when a select_case pending exists) ────────
  if (SELECTION_RE.test(body) && pending) {
    if (pending.expiresAt.getTime() > Date.now()) {
      return resolveSelection(identity, pending, parseInt(body, 10));
    }
    // Expired: the number was a selection attempt — do NOT ingest it as content.
    await deletePending(identity.phoneE164);
    await reply(identity.phoneE164, 'Your selection timed out. Send the link or text again to pick a case.', 'notice');
    return { ingested: false, reason: 'selection_expired' };
  }

  // ── Otherwise it's new content (non-numeric, or numeric with no pending) ──────
  const classified = classify(body);
  if (!classified) {
    // Empty/whitespace — not a valid replacement; keep any existing pending.
    await reply(identity.phoneE164, 'Send a link or some text to add it as a source.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  // Valid new content replaces any existing pending selection.
  if (pending) await deletePending(identity.phoneE164);

  return ingestContent(identity, classified);
}

// ── New-content routing (1 / 0 / many) ────────────────────────────────────────
async function ingestContent(
  identity: WhatsAppIdentity,
  classified: { type: 'text' | 'url'; content: string; label: string },
): Promise<IngestResult> {
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

  // Multiple active cases → hold a pending source + numbered list (Phase 13D).
  if (activeCases.length > 1) {
    const options: CaseOption[] = activeCases
      .slice(0, MAX_CASE_OPTIONS)
      .map((c, i) => ({ index: i + 1, caseId: c.id, title: c.title }));
    await upsertPending(identity, {
      sourceType:  classified.type,
      label:       classified.label,
      content:     classified.content,
      caseOptions: options,
    });
    await reply(identity.phoneE164, buildCaseListMessage(options, activeCases.length), 'notice');
    return { ingested: false, reason: 'pending_created' };
  }

  // Exactly one active case → add the source. The case was selected via
  // where:{ userId }, so ownership holds by construction.
  const target = activeCases[0];
  const source = await sourceService.addSource(target.id, {
    type:    classified.type,
    label:   classified.label,
    content: classified.content,
  });
  if (!source) {
    await reply(identity.phoneE164, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  return finishAddedSource(identity, target.title, target.id, source, classified.content);
}

// ── Post-addSource handling: confirm, or open a manual_text recovery ──────────
// For a url source whose extraction failed/partial, save a manual_text pending and
// invite the user to paste the real text. Otherwise confirm normally. Never throws.
type AddedSource = NonNullable<Awaited<ReturnType<typeof sourceService.addSource>>>;

async function finishAddedSource(
  identity: WhatsAppIdentity,
  title: string,
  caseId: string,
  source: AddedSource,
  content: string,
): Promise<IngestResult> {
  const isUrl = source.type === 'url';
  const status = source.extractionStatus;

  if (isUrl && (status === 'failed' || status === 'partial')) {
    // Do NOT confirm as if it were good — hold a recovery and ask for the text.
    await upsertManualTextPending(identity, {
      caseId, sourceId: source.id, label: source.label, content,
    });
    await reply(identity.phoneE164, recoveryMessage(content, status), 'notice');
    return { ingested: true, reason: 'manual_text_pending' };
  }

  // success (url) or skipped (text) → normal confirmation.
  const msg = isUrl ? urlSuccessMessage(title, caseId) : confirmation(title, caseId);
  await reply(identity.phoneE164, msg, 'confirmation');
  return { ingested: true, reason: 'added' };
}

// ── manual_text recovery: attach the next message to the remembered source ─────
async function handleManualText(
  identity: WhatsAppIdentity,
  pending: WhatsAppPendingSource,
  body: string,
): Promise<IngestResult> {
  const classified = classify(body);

  // Empty/whitespace → keep the pending and re-prompt.
  if (!classified) {
    await reply(identity.phoneE164, 'Send me the post or page text to finish adding the link, or send a new link.', 'notice');
    return { ingested: false, reason: 'manual_text_pending' };
  }

  // A new URL → cancel this fallback and process the new link as fresh content.
  if (classified.type === 'url') {
    await deletePending(identity.phoneE164);
    await reply(identity.phoneE164, "Okay, I'll skip the manual text for the previous link and use this new one instead.", 'notice');
    return ingestContent(identity, classified);
  }

  // Plain text → attach as manualText to the remembered source (preserves the URL,
  // stores the text, flips extraction to success, re-analyzes — via updateSource).
  if (!pending.caseId || !pending.sourceId) {
    // Defensive: malformed pending — drop it and treat the text as new content.
    await deletePending(identity.phoneE164);
    return ingestContent(identity, classified);
  }

  const updated = await sourceService.updateSource(pending.caseId, pending.sourceId, {
    manualText: classified.content,
  });
  await deletePending(identity.phoneE164);

  if (!updated) {
    await reply(identity.phoneE164, 'That source is no longer available.', 'notice');
    return { ingested: false, reason: 'manual_text_unavailable' };
  }

  await reply(identity.phoneE164, 'Great, I added the pasted text to the source and it is ready for analysis.', 'confirmation');
  return { ingested: true, reason: 'manual_text_attached' };
}

// ── Selection resolution ──────────────────────────────────────────────────────
async function resolveSelection(
  identity: WhatsAppIdentity,
  pending: WhatsAppPendingSource,
  n: number,
): Promise<IngestResult> {
  const options = pending.caseOptions as unknown as CaseOption[];

  // Out of range → keep the pending so the user can retry with a valid number.
  if (n < 1 || n > options.length) {
    await reply(identity.phoneE164, `Please reply with a number between 1 and ${options.length}.`, 'notice');
    return { ingested: false, reason: 'selection_invalid' };
  }

  const selected = options[n - 1];

  // Re-check LIVE: the chosen case must still belong to this user, exist, and be
  // active (not completed). Guards against deletion/completion/reassignment between
  // showing the list and the reply.
  const liveCase = await prisma.contentCase.findFirst({
    where:  { id: selected.caseId, userId: identity.userId, status: { not: 'completed' } },
    select: { id: true, title: true },
  });
  if (!liveCase) {
    await deletePending(identity.phoneE164);
    await reply(identity.phoneE164, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  const source = await sourceService.addSource(liveCase.id, {
    type:    pending.sourceType as 'text' | 'url',
    label:   pending.label,
    content: pending.content,
  });
  if (!source) {
    await deletePending(identity.phoneE164);
    await reply(identity.phoneE164, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  // Clear the select_case pending FIRST; finishAddedSource may open a fresh
  // manual_text pending (for a url whose extraction failed/partial).
  await deletePending(identity.phoneE164);
  return finishAddedSource(identity, liveCase.title, liveCase.id, source, pending.content);
}
