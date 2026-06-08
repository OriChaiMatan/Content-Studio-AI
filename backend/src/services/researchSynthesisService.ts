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

function isTransient(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.APIConnectionTimeoutError ||
    (err instanceof Anthropic.APIError && err.status === 529)
  );
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
      max_tokens: 8000,
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

/** Synthesize a v1-valid v2 ResearchContext. NEVER throws. */
export async function synthesize(args: SynthesizeArgs): Promise<ResearchContextV2> {
  const language = resolveLang(args.run, args.caseItem);
  const sourceRefs = buildSourceRefs(args.primarySources, args.contextSources);
  const input: SynthesisInput = { ...args, language, sourceRefs };

  if (!researchSynthesisConfig.enabled) return buildV2Stub(input, 'mock-research', false);

  const client = getResearchClient();
  if (!client) return buildV2Stub(input, 'mock-research', false);

  try {
    let raw: Record<string, unknown> | null;
    try {
      raw = await callClaude(client, input);
    } catch (err) {
      if (isTransient(err)) raw = await callClaude(client, input);
      else throw err;
    }
    if (!raw) {
      console.warn('[researchSynthesis] no tool call returned — using mock fallback.');
      return buildV2Stub(input, 'mock-fallback', true);
    }

    try {
      return finalizeSynthesis(raw, input);
    } catch (validationErr) {
      const detail = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.warn(`[researchSynthesis] validation failed (attempt 1): ${detail}`);
      const corrective =
        `Your previous synthesis did not satisfy the schema:\n${detail}\n` +
        `Call ${RESEARCH_TOOL.name} again with corrected values. Remember: every sourceConnection must cite ≥2 valid [S#] refs (unless there is only one source), and every field/array constraint must hold.`;
      let retryRaw: Record<string, unknown> | null;
      try {
        retryRaw = await callClaude(client, input, corrective);
      } catch (err) {
        if (isTransient(err)) retryRaw = await callClaude(client, input, corrective);
        else throw err;
      }
      if (!retryRaw) return buildV2Stub(input, 'mock-fallback', true);
      try {
        return finalizeSynthesis(retryRaw, input);
      } catch (retryErr) {
        const d2 = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.warn(`[researchSynthesis] validation failed again: ${d2} — using mock fallback.`);
        return buildV2Stub(input, 'mock-fallback', true);
      }
    }
  } catch (err) {
    let detail: string;
    if (err instanceof Anthropic.APIError) detail = `${err.name} status=${err.status} type=${err.type ?? 'n/a'}: ${err.message}`;
    else detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[researchSynthesis] Claude call failed (${detail}) — using mock fallback.`);
    return buildV2Stub(input, 'mock-fallback', true);
  }
}

export const researchSynthesisService = { synthesize };
