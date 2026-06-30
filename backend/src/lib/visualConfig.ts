import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Visual Engine configuration (Phase: Visual-1).
// Real OpenAI generation is gated behind IMAGE_GENERATION_ENABLED (default OFF).
// Provider resolution:
//   enabled=false           -> 'disabled'  (NEVER calls OpenAI; UI shows degraded)
//   enabled + provider=mock -> 'mock'      (offline placeholder background; dev only)
//   enabled + provider=openai -> 'openai'  (real gpt-image-1)
// ─────────────────────────────────────────────────────────────────────────────

function envInt(name: string, fallback: number): number {
  const n = process.env[name] ? Number.parseInt(process.env[name] as string, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type ImageProvider = 'openai' | 'mock' | 'disabled';

export const imageGenConfig = {
  enabled: process.env.IMAGE_GENERATION_ENABLED === 'true',
  providerPref: (process.env.IMAGE_PROVIDER === 'mock' ? 'mock' : 'openai') as 'openai' | 'mock',
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.IMAGE_MODEL ?? 'gpt-image-1',
  size: process.env.IMAGE_SIZE ?? '1536x1024',
  quality: process.env.IMAGE_QUALITY ?? 'high',
  timeoutMs: envInt('IMAGE_TIMEOUT_MS', 120_000),
  rateLimitMax: envInt('IMAGE_RATE_LIMIT_MAX', 10),
  // Resolved from the backend working directory (same in dev via tsx and in prod
  // via `node dist/server.js`, both run from backend/).
  fontsDir: process.env.VISUAL_FONTS_DIR ?? path.resolve(process.cwd(), 'assets/fonts'),
  // Always resolve to an ABSOLUTE path: a relative env value would make
  // res.sendFile throw ("path must be absolute"). path.resolve handles both
  // (absolute passes through unchanged; relative resolves against cwd).
  storageDir: path.resolve(process.env.VISUAL_STORAGE_DIR ?? 'var/visuals'),
} as const;

/** Which provider will actually run, honoring the "disabled => degraded, never call
 *  OpenAI" contract. */
export function effectiveProvider(): ImageProvider {
  if (!imageGenConfig.enabled) return 'disabled';
  return imageGenConfig.providerPref === 'mock' ? 'mock' : 'openai';
}
