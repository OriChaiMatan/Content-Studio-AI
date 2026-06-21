import { Prisma, type WhatsAppPendingSource } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { whatsappConfig } from '../lib/whatsapp';
import { channelSend, type Channel } from '../lib/channelSend';
import { sourceService } from './sourceService';
import { isAuthwalledHost } from './urlExtractionService';

// ─────────────────────────────────────────────────────────────────────────────
// Channel-agnostic source ingestion (extracted from whatsappIngestionService).
//
// A VERIFIED sender's text/URL message becomes a ContentSource. Routing by active
// case count:
//   1 active   → add source + confirm
//   0 active   → notice, no source, no case created
//   >1 active  → hold a pending source + numbered list; a numeric reply files it
//
// Plus the failed/partial-URL → manual-text recovery flow. Identical behaviour to
// the previous WhatsApp-only service; the only change is that it operates on an
// abstract `actor` ({ userId, channel, externalId }) and replies via channelSend,
// so a Telegram transport can reuse it unchanged. NEVER triggers the pipeline.
// ─────────────────────────────────────────────────────────────────────────────

// The verified actor behind an inbound message — the channel-agnostic identity the
// transport (whatsappService / future telegramService) resolves before ingesting.
export interface Actor {
  userId:     string;
  channel:    Channel;
  externalId: string;   // phoneE164 (whatsapp) / chat id (telegram)
}

// Minimal inbound shape this service needs (transport-agnostic).
export interface IngestMessage {
  type: string;
  body: string;
}

const PENDING_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_CASE_OPTIONS = 9;              // numbered list cap
const TITLE_MAX = 60;                    // truncate long titles in the list

// Human label for the channel a source arrived on (used as the source label).
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram' };

// Stored snapshot of the numbered list shown to the user.
interface CaseOption {
  index:  number;
  caseId: string;
  title:  string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Active = not completed (draft, research, fact_check, generating, in_review).
async function findActiveCases(userId: string) {
  return prisma.contentCase.findMany({
    where:   { userId, status: { not: 'completed' } },
    orderBy: { updatedAt: 'desc' },
    select:  { id: true, title: true },
  });
}

// ── Pending repo (lazy expiry — no background sweeper) ─────────────────────────
// Keyed by (channel, externalId) so WhatsApp and Telegram pendings never collide.

function findPending(channel: Channel, externalId: string): Promise<WhatsAppPendingSource | null> {
  return prisma.whatsAppPendingSource.findUnique({
    where: { channel_externalId: { channel, externalId } },
  });
}

async function upsertPending(
  actor: Actor,
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
    where:  { channel_externalId: { channel: actor.channel, externalId: actor.externalId } },
    create: { userId: actor.userId, channel: actor.channel, externalId: actor.externalId, ...payload },
    update: { userId: actor.userId, ...payload },
  });
}

// manual_text pending — a url source was created with failed/partial extraction;
// the next plain-text message recovers it. caseOptions is unused (stored as []).
async function upsertManualTextPending(
  actor: Actor,
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
    where:  { channel_externalId: { channel: actor.channel, externalId: actor.externalId } },
    create: { userId: actor.userId, channel: actor.channel, externalId: actor.externalId, ...payload },
    update: { userId: actor.userId, ...payload },
  });
}

async function deletePending(channel: Channel, externalId: string): Promise<void> {
  await prisma.whatsAppPendingSource.deleteMany({ where: { channel, externalId } });
}

// ── Classification & formatting ───────────────────────────────────────────────

// Classify as 'url' ONLY when the entire trimmed message is a single http/https
// URL token. Mixed text-with-URL and bare domains are plain text.
const SINGLE_URL_RE = /^https?:\/\/\S+$/i;
// Selection: a BARE integer only. "1." / "case 1" / "1 thanks" are NOT selections.
const SELECTION_RE = /^\d+$/;

function classify(body: string, channel: Channel): { type: 'text' | 'url'; content: string; label: string } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;   // empty/whitespace → nothing to ingest
  const name = CHANNEL_LABEL[channel];
  if (SINGLE_URL_RE.test(trimmed)) {
    return { type: 'url', content: trimmed, label: `${name} link` };
  }
  return { type: 'text', content: trimmed, label: `${name} message` };
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

// URL extraction failed/partial — invite the manual-text recovery.
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

// ── Entry point — called by a transport for a VERIFIED actor ───────────────────
export async function ingest(actor: Actor, msg: IngestMessage): Promise<IngestResult> {
  // Non-text (image/pdf/voice/…) is out of scope. Leave any pending intact (an
  // image is not a valid replacement) — just notify.
  if (msg.type !== 'text') {
    await channelSend(actor.channel, actor.externalId, 'I can only accept text messages and links right now.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  const body = msg.body.trim();
  let pending = await findPending(actor.channel, actor.externalId);

  // ── manual_text recovery mode ────────────────────────────────────────────────
  // A url source was created with failed/partial extraction; we're waiting for the
  // user to paste the post/page text. This branch runs BEFORE numeric-selection so a
  // pasted number is treated as text, not a case pick.
  if (pending && pending.mode === 'manual_text') {
    if (pending.expiresAt.getTime() > Date.now()) {
      return handleManualText(actor, pending, body);
    }
    // Expired → drop it and treat this message as fresh content.
    await deletePending(actor.channel, actor.externalId);
    pending = null;
  }

  // ── Numeric reply → selection (only when a select_case pending exists) ────────
  if (SELECTION_RE.test(body) && pending) {
    if (pending.expiresAt.getTime() > Date.now()) {
      return resolveSelection(actor, pending, parseInt(body, 10));
    }
    // Expired: the number was a selection attempt — do NOT ingest it as content.
    await deletePending(actor.channel, actor.externalId);
    await channelSend(actor.channel, actor.externalId, 'Your selection timed out. Send the link or text again to pick a case.', 'notice');
    return { ingested: false, reason: 'selection_expired' };
  }

  // ── Otherwise it's new content (non-numeric, or numeric with no pending) ──────
  const classified = classify(body, actor.channel);
  if (!classified) {
    // Empty/whitespace — not a valid replacement; keep any existing pending.
    await channelSend(actor.channel, actor.externalId, 'Send a link or some text to add it as a source.', 'notice');
    return { ingested: false, reason: 'unsupported' };
  }

  // Valid new content replaces any existing pending selection.
  if (pending) await deletePending(actor.channel, actor.externalId);

  return ingestContent(actor, classified);
}

// ── New-content routing (1 / 0 / many) ────────────────────────────────────────
async function ingestContent(
  actor: Actor,
  classified: { type: 'text' | 'url'; content: string; label: string },
): Promise<IngestResult> {
  const activeCases = await findActiveCases(actor.userId);

  // Zero active cases → no source, no case creation (scope).
  if (activeCases.length === 0) {
    await channelSend(
      actor.channel,
      actor.externalId,
      `You have no active cases. Create or open one in the app: ${whatsappConfig.appBaseUrl}`,
      'notice',
    );
    return { ingested: false, reason: 'no_active_cases' };
  }

  // Multiple active cases → hold a pending source + numbered list.
  if (activeCases.length > 1) {
    const options: CaseOption[] = activeCases
      .slice(0, MAX_CASE_OPTIONS)
      .map((c, i) => ({ index: i + 1, caseId: c.id, title: c.title }));
    await upsertPending(actor, {
      sourceType:  classified.type,
      label:       classified.label,
      content:     classified.content,
      caseOptions: options,
    });
    await channelSend(actor.channel, actor.externalId, buildCaseListMessage(options, activeCases.length), 'notice');
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
    await channelSend(actor.channel, actor.externalId, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  return finishAddedSource(actor, target.title, target.id, source, classified.content);
}

// ── Post-addSource handling: confirm, or open a manual_text recovery ──────────
// For a url source whose extraction failed/partial, save a manual_text pending and
// invite the user to paste the real text. Otherwise confirm normally. Never throws.
type AddedSource = NonNullable<Awaited<ReturnType<typeof sourceService.addSource>>>;

async function finishAddedSource(
  actor: Actor,
  title: string,
  caseId: string,
  source: AddedSource,
  content: string,
): Promise<IngestResult> {
  const isUrl = source.type === 'url';
  const status = source.extractionStatus;

  if (isUrl && (status === 'failed' || status === 'partial')) {
    // Do NOT confirm as if it were good — hold a recovery and ask for the text.
    await upsertManualTextPending(actor, {
      caseId, sourceId: source.id, label: source.label, content,
    });
    await channelSend(actor.channel, actor.externalId, recoveryMessage(content, status), 'notice');
    return { ingested: true, reason: 'manual_text_pending' };
  }

  // success (url) or skipped (text) → normal confirmation.
  const msg = isUrl ? urlSuccessMessage(title, caseId) : confirmation(title, caseId);
  await channelSend(actor.channel, actor.externalId, msg, 'confirmation');
  return { ingested: true, reason: 'added' };
}

// ── manual_text recovery: attach the next message to the remembered source ─────
async function handleManualText(
  actor: Actor,
  pending: WhatsAppPendingSource,
  body: string,
): Promise<IngestResult> {
  const classified = classify(body, actor.channel);

  // Empty/whitespace → keep the pending and re-prompt.
  if (!classified) {
    await channelSend(actor.channel, actor.externalId, 'Send me the post or page text to finish adding the link, or send a new link.', 'notice');
    return { ingested: false, reason: 'manual_text_pending' };
  }

  // A new URL → cancel this fallback and process the new link as fresh content.
  if (classified.type === 'url') {
    await deletePending(actor.channel, actor.externalId);
    await channelSend(actor.channel, actor.externalId, "Okay, I'll skip the manual text for the previous link and use this new one instead.", 'notice');
    return ingestContent(actor, classified);
  }

  // Plain text → attach as manualText to the remembered source (preserves the URL,
  // stores the text, flips extraction to success, re-analyzes — via updateSource).
  if (!pending.caseId || !pending.sourceId) {
    // Defensive: malformed pending — drop it and treat the text as new content.
    await deletePending(actor.channel, actor.externalId);
    return ingestContent(actor, classified);
  }

  const updated = await sourceService.updateSource(pending.caseId, pending.sourceId, {
    manualText: classified.content,
  });
  await deletePending(actor.channel, actor.externalId);

  if (!updated) {
    await channelSend(actor.channel, actor.externalId, 'That source is no longer available.', 'notice');
    return { ingested: false, reason: 'manual_text_unavailable' };
  }

  await channelSend(actor.channel, actor.externalId, 'Great, I added the pasted text to the source and it is ready for analysis.', 'confirmation');
  return { ingested: true, reason: 'manual_text_attached' };
}

// ── Selection resolution ──────────────────────────────────────────────────────
async function resolveSelection(
  actor: Actor,
  pending: WhatsAppPendingSource,
  n: number,
): Promise<IngestResult> {
  const options = pending.caseOptions as unknown as CaseOption[];

  // Out of range → keep the pending so the user can retry with a valid number.
  if (n < 1 || n > options.length) {
    await channelSend(actor.channel, actor.externalId, `Please reply with a number between 1 and ${options.length}.`, 'notice');
    return { ingested: false, reason: 'selection_invalid' };
  }

  const selected = options[n - 1];

  // Re-check LIVE: the chosen case must still belong to this user, exist, and be
  // active (not completed). Guards against deletion/completion/reassignment between
  // showing the list and the reply.
  const liveCase = await prisma.contentCase.findFirst({
    where:  { id: selected.caseId, userId: actor.userId, status: { not: 'completed' } },
    select: { id: true, title: true },
  });
  if (!liveCase) {
    await deletePending(actor.channel, actor.externalId);
    await channelSend(actor.channel, actor.externalId, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  const source = await sourceService.addSource(liveCase.id, {
    type:    pending.sourceType as 'text' | 'url',
    label:   pending.label,
    content: pending.content,
  });
  if (!source) {
    await deletePending(actor.channel, actor.externalId);
    await channelSend(actor.channel, actor.externalId, 'That case is no longer available.', 'notice');
    return { ingested: false, reason: 'case_unavailable' };
  }

  // Clear the select_case pending FIRST; finishAddedSource may open a fresh
  // manual_text pending (for a url whose extraction failed/partial).
  await deletePending(actor.channel, actor.externalId);
  return finishAddedSource(actor, liveCase.title, liveCase.id, source, pending.content);
}
