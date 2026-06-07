import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, sourceAnalysisConfig } from '../lib/anthropic';
import { SourceIntelligenceSchema, type SourceIntelligence } from '../schemas/aiContractSchemas';
import { generateSourceIntelligence } from './sourceIntelligenceService';

// ─────────────────────────────────────────────────────────────────────────────
// Source Analysis Service — real Claude agent with permanent mock fallback
// (Phase 8B)
//
// analyze() answers "what is this source saying?" using Claude Sonnet, validated
// against SourceIntelligenceSchema. It NEVER throws to the caller: on any failure
// (disabled, no key, timeout, transient API error, invalid JSON, validation
// failure) it falls back to the deterministic mock generator. The pipeline,
// persistence, and UI layers are unaffected by which path produced the result.
//
// Boundaries (Phase 8B): no verification, no web search, no content generation.
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceAnalysisInput {
  type: string;    // 'text' | 'url' | 'pdf'
  label: string;
  content: string;
}

// Reserve headroom for the system prompt + JSON tool structure; spend the rest
// of the token budget on the source content. ~4 chars/token is a safe coarse
// approximation that avoids a separate countTokens round-trip.
const PROMPT_OVERHEAD_TOKENS = 1500;
const CHARS_PER_TOKEN = 4;

// ── System prompt (stable → prompt-cached) ──────────────────────────────────
// Frozen content: no timestamps, IDs, or per-request data. The volatile source
// content goes in the user turn, after the cache breakpoint.
const SYSTEM_PROMPT = `You are a Source Analysis Agent for a content studio. Your job is to read one source (text, a URL reference, or a document reference) and extract a structured, neutral analysis of WHAT THE SOURCE IS SAYING.

You are NOT verifying claims, NOT searching the web, and NOT generating marketing content. You only describe and structure the source's own content.

Rules:
- summary: a concise, neutral 1–3 sentence description of the source.
- mainTopics: 1–10 short topic phrases.
- keywords: 1–10 salient keywords.
- claims: 0–10 distinct assertions the source makes. For each, classify type as one of announcement | statistic | prediction | opinion | definition. Set verifiable=true only if the claim could in principle be checked against external evidence. extractionConfidence (0–100) is how confident you are that you extracted the claim faithfully — NOT whether the claim is true.
- entities: 0–20 named entities, each typed as company | person | product | technology | location | organization.
- sentiment: the source's overall tone — positive | negative | neutral | mixed.
- importanceScore (0–100): how substantive/information-rich the source is.
- contentAngles: 0–6 angles a writer could explore based on this source.
- language: the BCP-47-ish language code of the source content (e.g. "en", "he").
- analysisConfidenceScore (0–100): your overall confidence in this extraction.

For URL or document references with no body text, analyze what can be inferred from the reference itself and assign low confidence. Always return your analysis via the provided tool.`;

// ── Tool definition (deterministic → cache-stable alongside the system) ──────
// Mirrors the model-produced subset of SourceIntelligenceSchema. The service
// stamps analysisVersion / truncated / analyzedAt; verificationStatus defaults
// via Zod. Schema-level numeric/length bounds are enforced by Zod after parse.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'record_source_analysis',
  description: 'Record the structured analysis of the source.',
  input_schema: {
    type: 'object',
    properties: {
      // NOTE: array minItems/maxItems mirror SourceIntelligenceSchema (Zod)
      // exactly. Without these bounds Claude can return e.g. 12 topics, which
      // then fails Zod (.max(10)) and forces a needless mock-fallback.
      summary: { type: 'string', description: 'Neutral 1–3 sentence description. Always in English, even for non-English sources.' },
      mainTopics: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10, description: '1 to 10 topic phrases.' },
      keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10, description: '1 to 10 keywords.' },
      claims: {
        type: 'array',
        minItems: 0,
        maxItems: 10,
        description: 'Up to 10 distinct assertions the source makes. Each claim must be ONE short statement — never combine several into one long claim.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'One single assertion, one sentence.' },
            type: { type: 'string', enum: ['announcement', 'statistic', 'prediction', 'opinion', 'definition'] },
            subject: { type: 'string', description: 'Optional entity name this claim is about.' },
            verifiable: { type: 'boolean' },
            extractionConfidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Integer 0-100, confidence in faithful extraction.' },
          },
          required: ['text', 'type', 'verifiable', 'extractionConfidence'],
        },
      },
      entities: {
        type: 'array',
        minItems: 0,
        maxItems: 20,
        description: 'Up to 20 named entities.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['company', 'person', 'product', 'technology', 'location', 'organization'] },
          },
          required: ['name', 'type'],
        },
      },
      sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
      importanceScore: { type: 'integer', minimum: 0, maximum: 100, description: 'Integer 0-100.' },
      contentAngles: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 6, description: '0 to 6 angles.' },
      language: { type: 'string', description: 'Two-letter language code of the SOURCE content, e.g. "en" for English, "he" for Hebrew.' },
      analysisConfidenceScore: { type: 'integer', minimum: 0, maximum: 100, description: 'Integer 0-100.' },
    },
    required: [
      'summary', 'mainTopics', 'keywords', 'claims', 'entities',
      'sentiment', 'importanceScore', 'contentAngles', 'language', 'analysisConfidenceScore',
    ],
  },
};

// Truncate the source content to fit the configured token budget. Returns the
// (possibly shortened) content and whether truncation occurred.
function truncateContent(content: string): { text: string; truncated: boolean } {
  const maxContentChars = Math.max(
    500,
    (sourceAnalysisConfig.maxInputTokens - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN,
  );
  if (content.length <= maxContentChars) return { text: content, truncated: false };
  return { text: content.slice(0, maxContentChars), truncated: true };
}

// Run the deterministic mock. `asFallback` stamps 'mock-fallback' so callers /
// tests can tell a Claude failure from the normal disabled path ('mock-2').
function runMock(input: SourceAnalysisInput, asFallback: boolean): SourceIntelligence {
  const intel = generateSourceIntelligence(input.type, input.label, input.content);
  if (asFallback) {
    intel.analysisVersion = 'mock-fallback';
    console.log('[sourceAnalysis] path=mock-fallback');
  }
  return intel;
}

// Is this a transient API error worth one retry?
function isTransient(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.APIConnectionTimeoutError ||
    (err instanceof Anthropic.APIError && err.status === 529)
  );
}

// Extract the tool-call input from a Claude message, or null if absent.
function extractToolInput(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === ANALYSIS_TOOL.name) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

// Build the user turn for a given (possibly truncated) source.
function buildUserText(input: SourceAnalysisInput, body: string, truncated: boolean): string {
  const header = `Source type: ${input.type}\nLabel: ${input.label || '(none)'}`;
  const note = truncated ? '\n\n[NOTE: source content was truncated to fit the analysis budget.]' : '';
  return `${header}\n\nContent:\n${body}${note}`;
}

// One Claude call. Throws on API/timeout errors; returns the raw tool input.
async function callClaude(
  client: Anthropic,
  userText: string,
  corrective?: string,
): Promise<Record<string, unknown> | null> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userText }];
  if (corrective) {
    // Re-prompt with the validation error so Claude can self-correct.
    messages.push({ role: 'assistant', content: 'I will correct the analysis.' });
    messages.push({ role: 'user', content: corrective });
  }

  const message = await client.messages.create(
    {
      model: sourceAnalysisConfig.model,
      // 8192 (up from 4096): the structured output for long, non-Latin (e.g.
      // Hebrew) sources tokenizes heavier; a tight cap truncated the tool JSON,
      // which surfaced as invalid/garbled input ("one huge claim") and forced a
      // mock-fallback. The output is bounded by the schema, so this is ample.
      max_tokens: 8192,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: ANALYSIS_TOOL.name },
      messages,
    },
    { timeout: sourceAnalysisConfig.timeoutMs },
  );

  // Diagnostic: a max_tokens stop means the tool JSON was likely truncated.
  if (message.stop_reason === 'max_tokens') {
    console.warn('[sourceAnalysis] Claude response hit max_tokens — tool output may be truncated.');
  }

  return extractToolInput(message);
}

// Stamp service-owned fields and validate against the contract schema.
function finalize(
  raw: Record<string, unknown>,
  truncated: boolean,
): SourceIntelligence {
  const candidate = {
    ...raw,
    analysisVersion: 'claude-1',
    truncated,
    analyzedAt: new Date().toISOString(),
  };
  const result = SourceIntelligenceSchema.parse(candidate);
  console.log('[sourceAnalysis] path=claude (success)');
  return result;
}

/**
 * Analyze a source. NEVER throws — always returns valid SourceIntelligence,
 * falling back to the deterministic mock on any failure.
 */
export async function analyze(input: SourceAnalysisInput): Promise<SourceIntelligence> {
  const client = getAnthropicClient();

  // Disabled, or no API key → mock directly (the normal, default path).
  if (!client) {
    // Debug-only: distinguish disabled vs. missing-key so logs are unambiguous.
    const path = !sourceAnalysisConfig.enabled ? 'mock-disabled' : 'mock-no-key';
    console.log(`[sourceAnalysis] path=${path}`);
    return runMock(input, false);
  }

  console.log('[sourceAnalysis] path=claude (attempting Claude analysis)');

  const { text: body, truncated } = truncateContent(input.content);
  const userText = buildUserText(input, body, truncated);

  try {
    // ── Attempt 1 ──────────────────────────────────────────────────────────
    let raw: Record<string, unknown> | null;
    try {
      raw = await callClaude(client, userText);
    } catch (err) {
      if (isTransient(err)) {
        // ONE retry on a transient API error.
        raw = await callClaude(client, userText);
      } else {
        throw err;
      }
    }

    if (!raw) {
      console.warn('[sourceAnalysis] Claude returned no tool call; falling back to mock.');
      return runMock(input, true);
    }

    // ── Validate; ONE corrective retry on validation failure ─────────────────
    try {
      return finalize(raw, truncated);
    } catch (validationErr) {
      const detail = validationErr instanceof Error ? validationErr.message : String(validationErr);
      // Requirement: log the EXACT validation failure (e.g. for Hebrew sources).
      console.warn(`[sourceAnalysis] Zod validation failed on Claude output (attempt 1): ${detail}`);
      const corrective =
        `Your previous analysis did not match the required schema:\n${detail}\n` +
        `Call ${ANALYSIS_TOOL.name} again with corrected values. ` +
        `mainTopics and keywords must each have 1 to 10 non-empty items; claims max 10; entities max 20; ` +
        `all scores are integers 0-100; language is a two-letter code like "he"; the summary must be in English.`;

      let retryRaw: Record<string, unknown> | null;
      try {
        retryRaw = await callClaude(client, userText, corrective);
      } catch (err) {
        if (isTransient(err)) {
          retryRaw = await callClaude(client, userText, corrective);
        } else {
          throw err;
        }
      }

      if (!retryRaw) {
        console.warn('[sourceAnalysis] corrective retry returned no tool call; falling back to mock.');
        return runMock(input, true);
      }
      try {
        return finalize(retryRaw, truncated);
      } catch (retryErr) {
        const retryDetail = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.warn(`[sourceAnalysis] Zod validation failed again after corrective retry: ${retryDetail}; falling back to mock.`);
        return runMock(input, true);
      }
    }
  } catch (err) {
    // API/timeout failures land here. Log status/type when available.
    let detail: string;
    if (err instanceof Anthropic.APIError) {
      detail = `${err.name} status=${err.status} type=${err.type ?? 'n/a'}: ${err.message}`;
    } else {
      detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    console.warn(`[sourceAnalysis] Claude API call failed (${detail}); falling back to mock.`);
    return runMock(input, true);
  }
}
