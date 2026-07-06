import Anthropic from '@anthropic-ai/sdk';

export const SPIKE_MODEL = process.env.PODCAST_SPIKE_MODEL ?? 'claude-sonnet-4-6';

// Dedicated singleton for the spike — no flags, no guards, just needs the API key.
// Separate from the production getContentClient() to avoid any flag entanglement.
let _client: Anthropic | null = null;

export function getSpikeClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('[podcast-spike] ANTHROPIC_API_KEY is not set. Add it to backend/.env');
  }
  _client = new Anthropic({ apiKey, maxRetries: 2 });
  return _client;
}

export function extractToolInput(message: Anthropic.Message, toolName: string): Record<string, unknown> {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      return block.input as Record<string, unknown>;
    }
  }
  throw new Error(`[podcast-spike] Expected tool_use(${toolName}) in response but got none`);
}

export function recordTelemetry(
  stage: string,
  message: Anthropic.Message,
  elapsedMs: number,
): import('./podcastSpikeTypes').StageTelemetry {
  const usage = message.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  return {
    stage,
    model: message.model,
    elapsedMs,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}
