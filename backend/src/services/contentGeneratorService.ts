import Anthropic from '@anthropic-ai/sdk';
import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import { getContentClient, contentGenerationConfig } from '../lib/anthropic';
import { buildGeneratorInput } from './generatorInput';
import { generateMockContent } from './mockContentService';
import { engineSystem, renderContext } from '../prompts/engine.system';
import { PLATFORM_SPECS } from '../prompts/platforms';
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

function extractToolInput(message: Anthropic.Message, toolName: string): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

// One Claude call for a platform. Throws on API/timeout; returns raw tool input.
async function callClaude(
  client: Anthropic,
  input: GeneratorInput,
  corrective: string | undefined,
): Promise<Record<string, unknown> | null> {
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
  // Effort (GA on the content model) — social = low, long-form = high. Validated
  // against the SDK's allowed set; unknown values are dropped (no API error).
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

  if (message.stop_reason === 'max_tokens') {
    console.warn(`[contentGen:${platform}] response hit max_tokens — output may be truncated.`);
  }
  return extractToolInput(message, spec.tool.name);
}

/** Generate one platform's output. NEVER throws — always returns a v2 output. */
export async function generateContent(input: GeneratorInput): Promise<GeneratedOutput> {
  const platform = input.contract.platform;
  const spec = PLATFORM_SPECS[platform];

  // Disabled → normal v2 mock (mock-2). No Claude call.
  if (!contentGenerationConfig.enabled) {
    return generateMockContent(input);
  }
  // Podcast gated separately → mock fallback (degraded), no Claude podcast call.
  if (platform === 'podcast' && !contentGenerationConfig.podcastEnabled) {
    console.warn('[contentGen:podcast] podcast generation disabled — using mock fallback.');
    return mockFallback(input);
  }

  const client = getContentClient();
  if (!client) {
    // Enabled but no API key → can't attempt; normal mock (not a Claude failure).
    return generateMockContent(input);
  }

  try {
    // Attempt 1 (with one transient retry).
    let raw: Record<string, unknown> | null;
    try {
      raw = await callClaude(client, input, undefined);
    } catch (err) {
      // Do NOT transient-retry long-form (podcast): a timeout retry would double
      // the wall-clock. With maxRetries:0 + the per-request timeout, one attempt
      // is bounded to ~1× CONTENT_GENERATION_PODCAST_TIMEOUT_MS → then fallback.
      if (isTransient(err) && !spec.longform) raw = await callClaude(client, input, undefined);
      else throw err;
    }
    if (!raw) {
      console.warn(`[contentGen:${platform}] no tool call returned — using mock fallback.`);
      return mockFallback(input);
    }

    // Validate; ONE corrective retry on validation failure.
    try {
      return spec.finalize(raw, input);
    } catch (validationErr) {
      const detail = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.warn(`[contentGen:${platform}] validation failed (attempt 1): ${detail}`);
      const corrective =
        `Your previous output did not satisfy the schema:\n${detail}\n` +
        `Call ${spec.tool.name} again with corrected values that satisfy all field and array-size constraints.`;
      let retryRaw: Record<string, unknown> | null;
      try {
        retryRaw = await callClaude(client, input, corrective);
      } catch (err) {
        if (isTransient(err) && !spec.longform) retryRaw = await callClaude(client, input, corrective);
        else throw err;
      }
      if (!retryRaw) return mockFallback(input);
      try {
        return spec.finalize(retryRaw, input);
      } catch (retryErr) {
        const d2 = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.warn(`[contentGen:${platform}] validation failed again: ${d2} — using mock fallback.`);
        return mockFallback(input);
      }
    }
  } catch (err) {
    let detail: string;
    if (err instanceof Anthropic.APIError) detail = `${err.name} status=${err.status} type=${err.type ?? 'n/a'}: ${err.message}`;
    else detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[contentGen:${platform}] Claude call failed (${detail}) — using mock fallback.`);
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
