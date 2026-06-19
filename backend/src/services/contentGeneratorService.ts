import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import { getContentClient, contentGenerationConfig } from '../lib/anthropic';
import { buildGeneratorInput } from './generatorInput';
import { generateMockContent } from './mockContentService';
import { engineSystem, renderContext } from '../prompts/engine.system';
import { PLATFORM_SPECS } from '../prompts/platforms';
import { computeThesisPreservation } from './thesisPreservation';
import type { GeneratedOutput, GeneratorInput, ContentPlatform } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Content Generator Service (Phase 9 CP-2)
//
// Real Claude generation behind CONTENT_GENERATION_ENABLED, with the v2 mock as
// the permanent fallback. generateContent() NEVER throws to the router:
//   - disabled            → v2 mock (generatorVersion "mock-2")
//   - podcast disabled     → v2 mock fallback (generatorVersion "mock-fallback", degraded)
//   - Claude success       → "claude-gen-1"
//   - Claude/validation fail (after retries) → v2 mock fallback (degraded)
// ─────────────────────────────────────────────────────────────────────────────

// v2 mock as a fallback: stamps mock-fallback + degraded so Review shows a badge.
function mockFallback(input: GeneratorInput): GeneratedOutput {
  const out = generateMockContent(input);
  return { ...out, metadata: { ...out.metadata, generatorVersion: 'mock-fallback', degraded: true } } as GeneratedOutput;
}

// Map a configured effort string to the SDK's allowed values; drop if invalid
// so a misconfigured env never causes an API error.
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
function resolveEffort(value: string | undefined): Effort | undefined {
  return value && (EFFORTS as string[]).includes(value) ? (value as Effort) : undefined;
}

function isTransient(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.APIConnectionTimeoutError ||
    (err instanceof Anthropic.APIError && err.status === 529)
  );
}

// Phase 10E.1 — persistent, structured capture of EVERY terminal content failure
// (the prior console.warn-only path lost the cause). Appends JSONL to
// backend/content-failures.log. Distinguishes api/timeout/no-tool/validation/
// truncation, and records the upstream research version so a content fallback on
// already-degraded research is unambiguous. Never blocks generation.
type ContentFailureKind = 'api-error' | 'no-tool-call' | 'validation-failed' | 'max-tokens-truncated';
const CONTENT_FAILURE_LOG = 'content-failures.log';
function logContentFailure(
  input: GeneratorInput, kind: ContentFailureKind, err: unknown, startedAt: number,
  phase: 'attempt-1' | 'corrective-retry', stopReason?: string | null, note?: string,
) {
  const platform = input.contract.platform;
  const spec = PLATFORM_SPECS[platform];
  const e = err as { name?: string; status?: number; type?: string; message?: string; request_id?: string; requestID?: string; stack?: string } | null;
  const isApi = err instanceof Anthropic.APIError;
  const classification =
    kind === 'max-tokens-truncated' ? 'max-tokens'
    : kind === 'no-tool-call' ? 'empty-no-tool-use'
    : kind === 'validation-failed' ? 'zod-or-length-validation'
    : err instanceof Anthropic.APIConnectionTimeoutError ? 'timeout'
    : isApi ? `api-${e?.status ?? '?'}-${e?.type ?? 'unknown'}`
    : 'unknown-exception';
  const rec = {
    ts: new Date().toISOString(),
    event: 'content_generation_failure',
    platform, kind, classification, phase,
    name: e?.name ?? null,
    status: isApi ? (e?.status ?? null) : null,
    type: isApi ? (e?.type ?? null) : null,
    requestId: e?.request_id ?? e?.requestID ?? null,
    message: kind === 'validation-failed' ? (e?.message ?? null) : (e?.message ?? null),
    note: note ?? null,
    elapsedMs: Date.now() - startedAt,
    model: contentGenerationConfig.model,
    effort: spec.longform ? contentGenerationConfig.effortLongform : contentGenerationConfig.effortSocial,
    maxTokens: spec.maxTokens,
    stopReason: stopReason ?? null,
    outputLanguage: input.contract.outputLanguage,
    researchGeneratorVersion: input.contract.researchGeneratorVersion ?? null,
    researchDegraded: input.contract.researchDegraded ?? null,
    caseId: input.contract.caseId,
    runId: input.contract.runId,
    stack: e?.stack ?? null,
  };
  try { fs.appendFileSync(path.resolve(process.cwd(), CONTENT_FAILURE_LOG), JSON.stringify(rec) + '\n'); } catch { /* never block on logging */ }
  const { stack: _omit, ...slim } = rec;
  console.warn('[contentGen] FAILURE ' + JSON.stringify(slim));
}

function extractToolInput(message: Anthropic.Message, toolName: string): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

// Phase 10E.5 — callClaude now surfaces stop_reason so the caller can detect
// max_tokens truncation (a silent quality-collapse risk) and never accept it.
type CallResult = { raw: Record<string, unknown> | null; stopReason: string | null };

// One Claude call for a platform. Throws on API/timeout.
async function callClaude(
  client: Anthropic,
  input: GeneratorInput,
  corrective: string | undefined,
): Promise<CallResult> {
  const platform = input.contract.platform;
  const spec = PLATFORM_SPECS[platform];
  const system = `${engineSystem(input.contract.outputLanguage)}\n\n${spec.instruction}`;

  const userText = `${renderContext(input)}\n\nGenerate the ${platform} content now via the tool.`;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userText }];
  if (corrective) {
    messages.push({ role: 'assistant', content: 'I will correct the output.' });
    messages.push({ role: 'user', content: corrective });
  }

  const timeout = spec.longform ? contentGenerationConfig.podcastTimeoutMs : contentGenerationConfig.timeoutMs;
  const effort = resolveEffort(spec.longform ? contentGenerationConfig.effortLongform : contentGenerationConfig.effortSocial);

  const message = await client.messages.create(
    {
      model: contentGenerationConfig.model,
      max_tokens: spec.maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [spec.tool],
      tool_choice: { type: 'tool', name: spec.tool.name },
      messages,
      ...(effort ? { output_config: { effort } } : {}),
    },
    { timeout },
  );

  return { raw: extractToolInput(message, spec.tool.name), stopReason: message.stop_reason ?? null };
}

/** Generate one platform's output, then attach the Thesis Preservation Score
 * (10E.2). NEVER throws — always returns a v2 output. */
export async function generateContent(input: GeneratorInput): Promise<GeneratedOutput> {
  const out = await produce(input);
  // Phase 10E.2 — measure how much of the winning thesis survived (deterministic,
  // no extra Claude call). Computed for every path (claude-gen-1 / mock / fallback)
  // so a mock fallback visibly scores low.
  const tps = computeThesisPreservation(input, out);
  if (tps) {
    const md = out.metadata as { thesisPreservation?: unknown; contentScore?: number | null };
    md.thesisPreservation = tps;
    md.contentScore = tps.score;   // Phase 10E.3 — quality = measured TPS, not a confidence average
  }
  return out;
}

async function produce(input: GeneratorInput): Promise<GeneratedOutput> {
  const platform = input.contract.platform;
  const spec = PLATFORM_SPECS[platform];

  // Disabled → normal v2 mock (mock-2). No Claude call.
  if (!contentGenerationConfig.enabled) {
    return generateMockContent(input);
  }

  const client = getContentClient();
  if (!client) {
    // Enabled but no API key → can't attempt; normal mock (not a Claude failure).
    return generateMockContent(input);
  }

  const startedAt = Date.now();

  // ONE corrective retry, shared by validation-failure AND truncation. Phase 10E.5:
  // a retry that is STILL truncated (max_tokens) or invalid → visible mock-fallback —
  // a truncated newsletter is NEVER silently accepted.
  async function correctiveRetry(correctiveMsg: string, reason: 'validation-failed' | 'max-tokens-truncated'): Promise<GeneratedOutput> {
    let r2: CallResult;
    try {
      r2 = await callClaude(client!, input, correctiveMsg);
    } catch (err) {
      if (isTransient(err) && !spec.longform) { try { r2 = await callClaude(client!, input, correctiveMsg); } catch (e2) { logContentFailure(input, 'api-error', e2, startedAt, 'corrective-retry'); return mockFallback(input); } }
      else { logContentFailure(input, 'api-error', err, startedAt, 'corrective-retry'); return mockFallback(input); }
    }
    if (!r2.raw) { logContentFailure(input, 'no-tool-call', null, startedAt, 'corrective-retry', r2.stopReason); return mockFallback(input); }
    if (r2.stopReason === 'max_tokens') { logContentFailure(input, 'max-tokens-truncated', null, startedAt, 'corrective-retry', r2.stopReason); return mockFallback(input); }
    try {
      return spec.finalize(r2.raw, input);
    } catch (retryErr) {
      logContentFailure(input, 'validation-failed', retryErr, startedAt, 'corrective-retry', r2.stopReason, `was: ${reason}`);
      return mockFallback(input);
    }
  }

  try {
    // Attempt 1 (with one transient retry for fast transient failures, social only).
    let r1: CallResult;
    try {
      r1 = await callClaude(client, input, undefined);
    } catch (err) {
      if (isTransient(err) && !spec.longform) r1 = await callClaude(client, input, undefined);
      else throw err;
    }
    if (!r1.raw) {
      logContentFailure(input, 'no-tool-call', null, startedAt, 'attempt-1', r1.stopReason);
      return mockFallback(input);
    }
    // Phase 10E.5 — truncation is a FAILURE, never silently accepted as claude-gen-1.
    if (r1.stopReason === 'max_tokens') {
      console.warn(`[contentGen:${platform}] output truncated (max_tokens) — retrying for a complete, concise version.`);
      return correctiveRetry(
        `Your previous output was TRUNCATED — it hit the token limit and was cut off mid-way. Produce a COMPLETE version: finish every field, no mid-sentence cutoffs, and be more CONCISE to fit within the limit while keeping the thesis-driven argument.`,
        'max-tokens-truncated',
      );
    }
    // Validate; ONE corrective retry on validation failure.
    try {
      return spec.finalize(r1.raw, input);
    } catch (validationErr) {
      const detail = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.warn(`[contentGen:${platform}] validation failed (attempt 1): ${detail}`);
      return correctiveRetry(
        `Your previous output did not satisfy the schema:\n${detail}\n` +
        `Call ${spec.tool.name} again with corrected values that satisfy all field and array-size constraints.`,
        'validation-failed',
      );
    }
  } catch (err) {
    logContentFailure(input, 'api-error', err, startedAt, 'attempt-1');
    return mockFallback(input);
  }
}

/**
 * Router: generate the selected platforms with bounded concurrency.
 * Order is preserved. Each generator is isolated (generateContent never throws),
 * so one platform failing only degrades that platform.
 */
export async function generateAll(
  platforms: ContentPlatform[],
  run: PipelineRun,
  caseItem: ContentCase,
  runSources: ContentSource[],
): Promise<GeneratedOutput[]> {
  if (platforms.length === 0) return [];
  const inputs = platforms.map(p => buildGeneratorInput(p, run, caseItem, runSources));
  const conc = Math.max(1, contentGenerationConfig.concurrency);
  const results: GeneratedOutput[] = [];
  for (let i = 0; i < inputs.length; i += conc) {
    const batch = inputs.slice(i, i + conc);
    const settled = await Promise.all(batch.map(inp => generateContent(inp)));
    results.push(...settled);
  }
  return results;
}

export const contentGeneratorService = { generateContent, generateAll };
