import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import { getResearchClient, researchSynthesisConfig } from '../lib/anthropic';
import { type ResearchContextV2 } from '../schemas/aiContractSchemas';
import {
  researchSystem,
  renderSynthesisContext,
  finalizeSynthesis,
  buildV2Stub,
  buildSourceRefs,
  RESEARCH_TOOL,
  type SynthesisInput,
} from '../prompts/research';

// ─────────────────────────────────────────────────────────────────────────────
// Research Synthesis Service (Phase 10A)
//
// Real Claude cross-source synthesis behind RESEARCH_SYNTHESIS_ENABLED, with the
// permanent v1 mock (wrapped as a v2 stub) as fallback. synthesize() NEVER throws
// and ALWAYS returns a v1-valid v2 superset, so the pipeline's research step is
// never broken by synthesis failure.
//   - disabled / no key → "mock-research" (degraded=false)
//   - Claude success      → "research-1"
//   - failure (retries)    → "mock-fallback" (degraded=true)
// ─────────────────────────────────────────────────────────────────────────────

export interface SynthesizeArgs {
  run: PipelineRun;
  caseItem: ContentCase;
  primarySources: ContentSource[];
  contextSources: ContentSource[];
}

function resolveLang(run: PipelineRun, c: ContentCase): 'en' | 'he' {
  if (run.outputLanguage === 'he') return 'he';
  if (run.outputLanguage === 'en') return 'en';
  return c.language === 'he' ? 'he' : 'en';
}

// Phase 10D.2 — a per-request TIMEOUT must NEVER be retried: a second full-timeout
// attempt on the same huge call just doubles wall-clock to ~480s for no benefit.
// "Transient" (worth a quick retry) = 429 / 500 / 529 / connection blip — but NOT
// a connection-timeout, and only when the failure happened FAST (see shouldRetry).
function isTransient(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return false;  // timeout is never transient-retryable
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    (err instanceof Anthropic.APIError && err.status === 529)
  );
}

// Only retry a fast-transient failure that ALSO failed quickly. A transient error
// that already burned a long time is not worth a second full-timeout attempt.
const RETRY_MAX_ELAPSED_MS = 45000;
function shouldRetry(err: unknown, elapsedMs: number): boolean {
  return isTransient(err) && elapsedMs < RETRY_MAX_ELAPSED_MS;
}

function extractToolInput(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === RESEARCH_TOOL.name) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

async function callClaude(client: Anthropic, input: SynthesisInput, corrective?: string): Promise<Record<string, unknown> | null> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: renderSynthesisContext(input) }];
  if (corrective) {
    messages.push({ role: 'assistant', content: 'I will correct the synthesis.' });
    messages.push({ role: 'user', content: corrective });
  }
  const message = await client.messages.create(
    {
      model: researchSynthesisConfig.model,
      // 10D adds a scored thesis competition (5–7 candidates) → larger output.
      max_tokens: 12000,
      system: [{ type: 'text', text: researchSystem(input.language), cache_control: { type: 'ephemeral' } }],
      tools: [RESEARCH_TOOL],
      tool_choice: { type: 'tool', name: RESEARCH_TOOL.name },
      messages,
    },
    { timeout: researchSynthesisConfig.timeoutMs },
  );
  if (message.stop_reason === 'max_tokens') {
    console.warn('[researchSynthesis] response hit max_tokens — output may be truncated.');
  }
  return extractToolInput(message);
}

// Phase 10D.0+ — persistent, structured capture of EVERY terminal research
// failure, so a degraded run's exact cause is recoverable from disk (the previous
// console.warn-only path lost the status/type/stack). Distinguishes 401/400/404/
// 429/timeout (api-error w/ status+type) from Zod (validation-failed) and empty
// responses (no-tool-call). Appends JSONL to backend/research-failures.log.
const FAILURE_LOG = 'research-failures.log';
type FailCtx = { phase: string; elapsedMs: number; model: string; timeoutMs: number; sourceCount: number; outputLanguage: string };
function logResearchFailure(kind: 'api-error' | 'no-tool-call' | 'validation-failed', err: unknown, ctx: FailCtx) {
  const e = err as { name?: string; status?: number; type?: string; message?: string; request_id?: string; requestID?: string; stack?: string } | undefined;
  const isApi = err instanceof Anthropic.APIError;
  const classification =
    kind === 'validation-failed' ? 'zod-validation-failure'
    : kind === 'no-tool-call' ? 'empty-response-no-tool-use'
    : err instanceof Anthropic.APIConnectionTimeoutError ? 'timeout'
    : isApi ? `api-${e?.status ?? '?'}-${e?.type ?? 'unknown'}`
    : 'unknown-exception';
  const rec = {
    ts: new Date().toISOString(),
    event: 'research_synthesis_failure',
    kind,
    classification,                         // e.g. api-401-authentication_error | api-429-rate_limit_error | timeout | zod-validation-failure
    name: e?.name ?? null,
    status: isApi ? (e?.status ?? null) : null,
    type: isApi ? (e?.type ?? null) : null,
    requestId: e?.request_id ?? e?.requestID ?? null,
    message: e?.message ?? String(err),
    phase: ctx.phase,                       // initial-call | initial-call-transient-retry | corrective-retry-call | corrective-retry-validate
    attempt: ctx.phase.includes('retry') ? 'retry' : 'first',
    elapsedMs: ctx.elapsedMs,
    model: ctx.model,
    timeoutMs: ctx.timeoutMs,
    sourceCount: ctx.sourceCount,
    outputLanguage: ctx.outputLanguage,
    stack: e?.stack ?? null,
  };
  try { fs.appendFileSync(path.resolve(process.cwd(), FAILURE_LOG), JSON.stringify(rec) + '\n'); } catch { /* never block the pipeline on logging */ }
  const { stack: _omit, ...slim } = rec;
  console.warn('[researchSynthesis] FAILURE ' + JSON.stringify(slim));
}

/** Synthesize a v1-valid v2 ResearchContext. NEVER throws. */
export async function synthesize(args: SynthesizeArgs): Promise<ResearchContextV2> {
  const language = resolveLang(args.run, args.caseItem);
  const sourceRefs = buildSourceRefs(args.primarySources, args.contextSources);
  const input: SynthesisInput = { ...args, language, sourceRefs };

  if (!researchSynthesisConfig.enabled) return buildV2Stub(input, 'mock-research', false);

  const client = getResearchClient();
  if (!client) return buildV2Stub(input, 'mock-research', false);

  const startedAt = Date.now();
  const ctx = (phase: string): FailCtx => ({
    phase, elapsedMs: Date.now() - startedAt, model: researchSynthesisConfig.model,
    timeoutMs: researchSynthesisConfig.timeoutMs, sourceCount: input.sourceRefs.length, outputLanguage: language,
  });
  let phase = 'initial-call';

  try {
    let raw: Record<string, unknown> | null;
    try {
      raw = await callClaude(client, input);
    } catch (err) {
      if (shouldRetry(err, Date.now() - startedAt)) { phase = 'initial-call-transient-retry'; raw = await callClaude(client, input); }
      else throw err;
    }
    if (!raw) {
      logResearchFailure('no-tool-call', new Error('forced tool_choice returned no tool_use block'), ctx(phase));
      return buildV2Stub(input, 'mock-fallback', true);
    }

    phase = 'validate';
    try {
      return finalizeSynthesis(raw, input);
    } catch (validationErr) {
      const detail = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.warn(`[researchSynthesis] validation failed (attempt 1): ${detail}`);
      const corrective =
        `Your previous synthesis did not satisfy the schema:\n${detail}\n` +
        `Call ${RESEARCH_TOOL.name} again with corrected values. Remember: every sourceConnection must cite ≥2 valid [S#] refs (unless there is only one source), and every field/array constraint must hold.`;
      phase = 'corrective-retry-call';
      let retryRaw: Record<string, unknown> | null;
      try {
        retryRaw = await callClaude(client, input, corrective);
      } catch (err) {
        if (shouldRetry(err, Date.now() - startedAt)) { phase = 'corrective-retry-transient-retry'; retryRaw = await callClaude(client, input, corrective); }
        else throw err;
      }
      if (!retryRaw) {
        logResearchFailure('no-tool-call', new Error('corrective retry returned no tool_use block'), ctx(phase));
        return buildV2Stub(input, 'mock-fallback', true);
      }
      phase = 'corrective-retry-validate';
      try {
        return finalizeSynthesis(retryRaw, input);
      } catch (retryErr) {
        logResearchFailure('validation-failed', retryErr, ctx(phase));
        return buildV2Stub(input, 'mock-fallback', true);
      }
    }
  } catch (err) {
    logResearchFailure('api-error', err, ctx(phase));
    return buildV2Stub(input, 'mock-fallback', true);
  }
}

export const researchSynthesisService = { synthesize };
