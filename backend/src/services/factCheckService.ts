import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentSource, PipelineRun } from '@prisma/client';
import { getFactCheckClient, factCheckConfig } from '../lib/anthropic';
import {
  FactCheckReportSchema,
  ResearchContextV2Schema,
  type FactCheckReport,
  type FactCheckClaim,
  type FactCheckRiskLevel,
  type ResearchContext,
} from '../schemas/aiContractSchemas';
import { generateFactCheckReport as mockFactCheck } from './mockAiService';
import {
  factCheckSystem,
  renderFactCheckContext,
  buildFactCheckRefs,
  FACT_CHECK_TOOL,
  type FactCheckInput,
} from '../prompts/factCheck';

// ─────────────────────────────────────────────────────────────────────────────
// Fact Check Service (Phase 3B)
//
// Real Claude claim-validation behind REAL_FACT_CHECK_ENABLED, replacing the mock
// that rubber-stamped ~70% of claims "verified" and never surfaced conflicts.
//
// FAILS CLOSED. On ANY failure (api / timeout / overloaded / malformed / invalid),
// it returns a DEGRADED report where nothing is verified, every claim is uncertain,
// integrityScore is low, and riskLevel is high — so generation becomes MORE
// cautious. It never fails open into "everything verified".
//   - disabled            → existing mock path (unchanged legacy behavior)
//   - enabled, no client   → DEGRADED (a misconfig must not silently use the mock)
//   - Claude success       → "factcheck-1"
//   - failure (retries)    → "degraded"
// ─────────────────────────────────────────────────────────────────────────────

export interface FactCheckArgs {
  run: PipelineRun;
  researchContext: ResearchContext;
  primarySources: ContentSource[];
  contextSources: ContentSource[];
}

interface AssemblyCtx {
  runId: string;
  caseId: string;
  sourceLabels: string[];
  claimsToCheck: string[];
}

// ── small utils ───────────────────────────────────────────────────────────────
const clamp = (n: unknown): number => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const dedupe = (a: string[]): string[] => [...new Set(a.filter(Boolean).map(s => s.trim()))];

// ── resilience (mirrors research/content) ─────────────────────────────────────
function isTransient(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return false;   // timeout is never transient-retryable
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    (err instanceof Anthropic.APIError && err.status === 529)
  );
}
const RETRY_MAX_ELAPSED_MS = 30000;
const shouldRetry = (err: unknown, elapsedMs: number): boolean => isTransient(err) && elapsedMs < RETRY_MAX_ELAPSED_MS;

const FAILURE_LOG = 'fact-check-failures.log';
function logFailure(kind: 'api-error' | 'no-tool-call' | 'validation-failed', err: unknown, ctx: { phase: string; elapsedMs: number; claims: number; lang: string }): void {
  const e = err as { name?: string; status?: number; type?: string; message?: string; request_id?: string; stack?: string } | undefined;
  const isApi = err instanceof Anthropic.APIError;
  const classification =
    kind === 'validation-failed' ? 'zod-validation-failure'
    : kind === 'no-tool-call' ? 'empty-response-no-tool-use'
    : err instanceof Anthropic.APIConnectionTimeoutError ? 'timeout'
    : isApi ? `api-${e?.status ?? '?'}-${e?.type ?? 'unknown'}`
    : 'unknown-exception';
  const rec = {
    ts: new Date().toISOString(), event: 'fact_check_failure', kind, classification,
    status: isApi ? (e?.status ?? null) : null, type: isApi ? (e?.type ?? null) : null,
    requestId: e?.request_id ?? null, message: e?.message ?? String(err),
    phase: ctx.phase, elapsedMs: ctx.elapsedMs, model: factCheckConfig.model,
    claims: ctx.claims, outputLanguage: ctx.lang, failedClosed: true, stack: e?.stack ?? null,
  };
  try { fs.appendFileSync(path.resolve(process.cwd(), FAILURE_LOG), JSON.stringify(rec) + '\n'); } catch { /* never block on logging */ }
  const { stack: _omit, ...slim } = rec;
  console.warn('[factCheck] FAILURE ' + JSON.stringify(slim));
}

// ── degraded report (FAIL CLOSED) ─────────────────────────────────────────────
// Nothing verified; every claim uncertain; low integrity; high risk.
export function degradedReport(ctx: AssemblyCtx, reason: string): FactCheckReport {
  const claims = dedupe(ctx.claimsToCheck);
  const uncertainClaims: FactCheckClaim[] = claims.map(c => ({
    claim: c, status: 'uncertain' as const, confidenceScore: 20, supportingSources: [],
    notes: 'Fact check degraded — treated as unverified.',
  }));
  return FactCheckReportSchema.parse({
    runId: ctx.runId, caseId: ctx.caseId, claimsChecked: claims.length,
    verifiedClaims: [], uncertainClaims, conflictingClaims: [], unsupportedClaims: [],
    warnings: [`Fact check degraded (${reason}). All claims treated as unverified; generation will be cautious.`],
    editorialWarnings: ['Fact check could not run — do not assert any claim as established fact.'],
    overallConfidenceScore: 25, integrityScore: 25, riskLevel: 'high',
    factCheckVersion: 'degraded', degraded: true, sourceReferences: ctx.sourceLabels,
  });
}

// ── assemble a validated report from Claude's raw tool output (pure) ──────────
function mapStatus(cls: string): FactCheckClaim['status'] {
  return cls === 'supported' ? 'verified' : cls === 'contradicted' ? 'conflicting' : cls === 'unsupported' ? 'unsupported' : 'uncertain';
}

function computeIntegrity(v: number, u: number, unsup: number, conf: number): number {
  const total = v + u + unsup + conf;
  let score = total ? Math.round((100 * (v * 1 + u * 0.5)) / total) : 50;
  if (conf > 0) score = Math.min(score, 55);    // any contradiction caps integrity
  if (unsup > 0) score = Math.min(score, 70);   // any unsupported claim caps integrity
  return clamp(score);
}
function computeRisk(score: number, conf: number, unsup: number, uncertain: number): FactCheckRiskLevel {
  if (conf > 0 || unsup > 0 || score < 50) return 'high';
  if (uncertain > 0 || score < 80) return 'medium';
  return 'low';
}

export function assembleReport(raw: Record<string, unknown>, ctx: AssemblyCtx): FactCheckReport {
  const rawClaims = Array.isArray(raw.claims) ? (raw.claims as Record<string, unknown>[]) : [];
  if (rawClaims.length === 0) throw new Error('fact check returned no claims');

  const verified: FactCheckClaim[] = [];
  const uncertain: FactCheckClaim[] = [];
  const unsupported: FactCheckClaim[] = [];
  const conflicting: FactCheckClaim[] = [];

  for (const rc of rawClaims) {
    const refs = Array.isArray(rc.sourceRefs) ? (rc.sourceRefs as unknown[]).map(String) : [];
    const selfVendor = rc.selfOrVendorReported === true;
    let cls = String(rc.classification ?? 'unsupported');
    let note = String(rc.note ?? '');

    // Deterministic CONSERVATIVE safety nets — enforce the rules even if Claude slips:
    if (cls === 'supported' && selfVendor) { cls = 'inference'; note = `[self/vendor-reported → not verified] ${note}`; }
    if (cls === 'supported' && refs.length === 0) { cls = 'unsupported'; note = `[no source ref → not verified] ${note}`; }

    const item: FactCheckClaim = {
      claim: String(rc.claim ?? '').trim() || '(empty claim)',
      status: mapStatus(cls), confidenceScore: clamp(rc.confidence), supportingSources: refs, notes: note,
    };
    if (cls === 'supported') verified.push(item);
    else if (cls === 'inference') uncertain.push(item);
    else if (cls === 'contradicted') conflicting.push(item);
    else unsupported.push(item);
  }

  for (const x of (Array.isArray(raw.crossSourceContradictions) ? (raw.crossSourceContradictions as Record<string, unknown>[]) : [])) {
    conflicting.push({
      claim: `${String(x.subject ?? 'contradiction')}: "${String(x.claimA ?? '')}" vs "${String(x.claimB ?? '')}"`,
      status: 'conflicting', confidenceScore: 70,
      supportingSources: Array.isArray(x.sourceRefs) ? (x.sourceRefs as unknown[]).map(String) : [],
      notes: 'Cross-source contradiction.',
    });
  }

  const editorialWarnings = Array.isArray(raw.editorialWarnings) ? (raw.editorialWarnings as unknown[]).map(String) : [];
  const integrityScore = computeIntegrity(verified.length, uncertain.length, unsupported.length, conflicting.length);
  const riskLevel = computeRisk(integrityScore, conflicting.length, unsupported.length, uncertain.length);
  const warnings: string[] = [];
  if (unsupported.length) warnings.push(`${unsupported.length} unsupported claim${unsupported.length !== 1 ? 's' : ''} — do not state as fact.`);
  if (conflicting.length) warnings.push(`${conflicting.length} conflicting claim${conflicting.length !== 1 ? 's' : ''} — never state as fact.`);

  return FactCheckReportSchema.parse({
    runId: ctx.runId, caseId: ctx.caseId,
    claimsChecked: verified.length + uncertain.length + unsupported.length + conflicting.length,
    verifiedClaims: verified, uncertainClaims: uncertain, conflictingClaims: conflicting, unsupportedClaims: unsupported,
    warnings, editorialWarnings, overallConfidenceScore: integrityScore, integrityScore, riskLevel,
    factCheckVersion: 'factcheck-1', degraded: false, sourceReferences: ctx.sourceLabels,
  });
}

// ── Claude call ───────────────────────────────────────────────────────────────
function extractToolInput(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === FACT_CHECK_TOOL.name) return block.input as Record<string, unknown>;
  }
  return null;
}

async function callClaude(client: Anthropic, input: FactCheckInput): Promise<Record<string, unknown> | null> {
  const message = await client.messages.create(
    {
      model: factCheckConfig.model,
      max_tokens: 4000,
      system: [{ type: 'text', text: factCheckSystem(input.language), cache_control: { type: 'ephemeral' } }],
      tools: [FACT_CHECK_TOOL],
      tool_choice: { type: 'tool', name: FACT_CHECK_TOOL.name },
      messages: [{ role: 'user', content: renderFactCheckContext(input) }],
    },
    { timeout: factCheckConfig.timeoutMs },
  );
  return extractToolInput(message);
}

// ── orchestrator ──────────────────────────────────────────────────────────────
export async function generateReport(args: FactCheckArgs): Promise<FactCheckReport> {
  const { run, researchContext, primarySources, contextSources } = args;
  const language: 'en' | 'he' = run.outputLanguage === 'he' ? 'he' : 'en';

  // Disabled → existing mock path, unchanged.
  if (!factCheckConfig.enabled) {
    return mockFactCheck(run, researchContext, primarySources, contextSources);
  }

  // Build the validation context (also the degrade fallback's claim set).
  const sources = [...primarySources, ...contextSources];
  const sourceRefs = buildFactCheckRefs(primarySources, contextSources);
  const v2 = ResearchContextV2Schema.safeParse(run.researchContext);
  const thesis = v2.success ? v2.data.synthesis.primaryAngle?.thesis : undefined;
  const claimsToCheck = dedupe([...(thesis ? [thesis] : []), ...researchContext.importantClaims]);
  const ctx: AssemblyCtx = {
    runId: run.id, caseId: researchContext.caseId,
    sourceLabels: sources.map(s => s.label || s.type), claimsToCheck,
  };

  const client = getFactCheckClient();
  if (!client) {
    // Enabled but misconfigured (no key) → DEGRADE, never silently use the unsafe mock.
    logFailure('api-error', new Error('fact check enabled but no API key/client'), { phase: 'no-client', elapsedMs: 0, claims: claimsToCheck.length, lang: language });
    return degradedReport(ctx, 'no_api_key');
  }

  const input: FactCheckInput = {
    language, sources, sourceRefs, thesis,
    claimsToCheck, researchTensions: researchContext.contradictions ?? [],
  };

  const startedAt = Date.now();
  let phase = 'initial-call';
  try {
    let rawOut: Record<string, unknown> | null;
    try {
      rawOut = await callClaude(client, input);
    } catch (err) {
      if (shouldRetry(err, Date.now() - startedAt)) { phase = 'transient-retry'; rawOut = await callClaude(client, input); }
      else throw err;
    }
    if (!rawOut) {
      logFailure('no-tool-call', new Error('forced tool_choice returned no tool_use block'), { phase, elapsedMs: Date.now() - startedAt, claims: claimsToCheck.length, lang: language });
      return degradedReport(ctx, 'no_tool_call');
    }
    try {
      return assembleReport(rawOut, ctx);
    } catch (validationErr) {
      logFailure('validation-failed', validationErr, { phase: 'assemble', elapsedMs: Date.now() - startedAt, claims: claimsToCheck.length, lang: language });
      return degradedReport(ctx, 'malformed_response');
    }
  } catch (err) {
    logFailure('api-error', err, { phase, elapsedMs: Date.now() - startedAt, claims: claimsToCheck.length, lang: language });
    return degradedReport(ctx, 'api_error');
  }
}

export const factCheckService = { generateReport, assembleReport, degradedReport };
