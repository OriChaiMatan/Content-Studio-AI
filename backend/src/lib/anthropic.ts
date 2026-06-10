import Anthropic from '@anthropic-ai/sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic SDK client singleton (Phase 8B)
//
// Mirrors the prisma.ts singleton pattern: one client instance survives tsx
// watch hot-reloads via the Node module cache. The client is created lazily so
// the server boots fine with SOURCE_ANALYSIS_ENABLED=false and no API key —
// callers must consult sourceAnalysisConfig.enabled before using it.
// ─────────────────────────────────────────────────────────────────────────────

const globalForAnthropic = globalThis as unknown as {
  anthropic?: Anthropic;        // source analysis client (SDK default retries)
  contentClient?: Anthropic;    // content generation client (no SDK retries)
  researchClient?: Anthropic;   // research synthesis client (no SDK retries)
};

// Source Analysis configuration, read once from the environment.
export const sourceAnalysisConfig = {
  // MUST default to false — Claude is opt-in. With this off, analyze() goes
  // straight to the deterministic mock and never touches the network.
  enabled: process.env.SOURCE_ANALYSIS_ENABLED === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.SOURCE_ANALYSIS_MODEL ?? 'claude-sonnet-4-6',
  maxInputTokens: parseInt(process.env.SOURCE_ANALYSIS_MAX_INPUT_TOKENS ?? '7000', 10),
  timeoutMs: parseInt(process.env.SOURCE_ANALYSIS_TIMEOUT_MS ?? '30000', 10),
} as const;

// Content Generator configuration (Phase 9). MUST default disabled — when off,
// content generation uses the permanent v2 mock. Podcast has a separate flag so
// long-form generation can be disabled independently (falls back to mock,
// degraded=true) without affecting the social/newsletter generators.
export const contentGenerationConfig = {
  enabled:        process.env.CONTENT_GENERATION_ENABLED === 'true',
  podcastEnabled: process.env.CONTENT_GENERATION_PODCAST_ENABLED === 'true',
  model:          process.env.CONTENT_GENERATION_MODEL ?? 'claude-sonnet-4-6',
  // Phase 10E.4 — social bumped low→medium: thesis-driven argument needs more
  // interpretive reasoning than a low-effort summary. Still fast (social 60s timeout).
  effortSocial:   process.env.CONTENT_GENERATION_EFFORT_SOCIAL ?? 'medium',
  effortLongform: process.env.CONTENT_GENERATION_EFFORT_LONGFORM ?? 'high',
  timeoutMs:        parseInt(process.env.CONTENT_GENERATION_TIMEOUT_MS ?? '60000', 10),
  podcastTimeoutMs: parseInt(process.env.CONTENT_GENERATION_PODCAST_TIMEOUT_MS ?? '180000', 10),
  concurrency:      parseInt(process.env.CONTENT_GENERATION_CONCURRENCY ?? '3', 10),
  // Phase 11D.2 — newsletter output ceiling. Was a hardcoded 4000, which a complete
  // Hebrew newsletter (~4.5–5.5k tokens; English ~1.9k) routinely exceeded, causing
  // truncation → corrective retry → second truncation → mock fallback (~75–90s wasted
  // + degraded output). 8000 gives ~1.5–2× headroom over the worst realistic Hebrew
  // newsletter while staying well under the podcast longform cap (16000). max_tokens is
  // a CEILING, not a target — English still finishes at its natural ~1.9k, so this adds
  // no latency to runs that already fit; it only lets the long Hebrew case complete.
  newsletterMaxTokens: parseInt(process.env.CONTENT_NEWSLETTER_MAX_TOKENS ?? '8000', 10),
} as const;

// Returns the shared Anthropic client, or null when analysis is disabled or no
// API key is configured. Never throws — callers fall back to the mock.
export function getAnthropicClient(): Anthropic | null {
  if (!sourceAnalysisConfig.enabled) return null;
  if (!sourceAnalysisConfig.apiKey) return null;

  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic({
      apiKey: sourceAnalysisConfig.apiKey,
      // Per-request timeout is also passed at the call site; this is a backstop.
      timeout: sourceAnalysisConfig.timeoutMs,
    });
  }

  return globalForAnthropic.anthropic;
}

// Research Synthesis configuration (Phase 10A). MUST default disabled — when off,
// the research step uses the permanent v1 mock (wrapped as a v2 stub).
export const researchSynthesisConfig = {
  enabled:   process.env.RESEARCH_SYNTHESIS_ENABLED === 'true',
  model:     process.env.RESEARCH_SYNTHESIS_MODEL ?? 'claude-sonnet-4-6',
  // Synthesis is a reasoning-heavy, large structured output. Latency scales with
  // language (Hebrew is token-dense) AND source count: ~60-70s for English, but
  // Hebrew with 4 sources + the primaryAngle nomination exceeds 120s and timed
  // out → mock fallback (degraded). 240s lets the single attempt complete on the
  // UI critical path; failure still falls back to the v1 mock, never hangs.
  timeoutMs: parseInt(process.env.RESEARCH_SYNTHESIS_TIMEOUT_MS ?? '240000', 10),
} as const;

// Research synthesis client (Phase 10A). Own gate + dedicated client with
// maxRetries: 0 (the service does bounded retries; the SDK must not multiply the
// per-request timeout on the UI critical path). Null when disabled / no key.
export function getResearchClient(): Anthropic | null {
  if (!researchSynthesisConfig.enabled) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) return null;
  if (!globalForAnthropic.researchClient) {
    globalForAnthropic.researchClient = new Anthropic({ apiKey, maxRetries: 0 });
  }
  return globalForAnthropic.researchClient;
}

// Returns the shared Anthropic client for CONTENT generation (Phase 9), or null
// when content generation is disabled or no API key is set. Reuses the same
// singleton client; per-request timeouts are passed at the call site. Never
// throws — callers fall back to the v2 mock.
export function getContentClient(): Anthropic | null {
  if (!contentGenerationConfig.enabled) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) return null;

  // Dedicated client with maxRetries: 0 — the service does its own bounded
  // retry, and we must NOT let the SDK's default 2 internal retries multiply a
  // per-request timeout (the cause of the unbounded podcast run). Isolated from
  // the source-analysis client so its retry behavior is unchanged.
  if (!globalForAnthropic.contentClient) {
    globalForAnthropic.contentClient = new Anthropic({ apiKey, maxRetries: 0 });
  }
  return globalForAnthropic.contentClient;
}

// ── Debug-only startup log (Phase 8B) ────────────────────────────────────────
// Reports the resolved config so we can confirm what the running process
// actually loaded from .env. Never prints the API key itself. Reads the raw
// env var separately to distinguish "unset" from a value that failed the
// `=== 'true'` check (e.g. quotes/whitespace).
console.log(
  '[anthropic] startup config:',
  JSON.stringify({
    SOURCE_ANALYSIS_ENABLED_raw: process.env.SOURCE_ANALYSIS_ENABLED ?? '(unset)',
    enabledResolved: sourceAnalysisConfig.enabled,
    apiKeyPresent: sourceAnalysisConfig.apiKey.length > 0,
    apiKeyLength: sourceAnalysisConfig.apiKey.length,
    model: sourceAnalysisConfig.model,
    clientResolved: getAnthropicClient() ? 'client' : 'null',
  }),
);
