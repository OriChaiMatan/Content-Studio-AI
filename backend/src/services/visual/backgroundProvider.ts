import { Resvg } from '@resvg/resvg-js';
import { imageGenConfig, type ImageProvider } from '../../lib/visualConfig';

// Typed provider error so the orchestrator can classify failures into a clean
// degraded state without ever crashing.
export class ProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'ProviderError'; this.code = code; }
}

// Real OpenAI gpt-image-1 background (no text — overlay is rendered by LumAI).
async function openaiBackground(prompt: string): Promise<Buffer> {
  if (!imageGenConfig.openaiKey) throw new ProviderError('no_key', 'OPENAI_API_KEY is not set.');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${imageGenConfig.openaiKey}` },
    body: JSON.stringify({ model: imageGenConfig.model, prompt, size: imageGenConfig.size, quality: imageGenConfig.quality, n: 1 }),
    signal: AbortSignal.timeout(imageGenConfig.timeoutMs),
  });
  const json = await res.json().catch(() => null) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } } | null;
  if (!res.ok) throw new ProviderError('provider_error', `OpenAI ${res.status}: ${json?.error?.message ?? 'image generation failed'}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError('provider_error', 'OpenAI returned no image.');
  return Buffer.from(b64, 'base64');
}

// Offline placeholder background for dev (IMAGE_PROVIDER=mock). Deliberately a plain
// dark gradient + faint grid — clearly NOT a premium AI render, so it never
// "simulates final quality"; it only lets the full async/render/UI flow run offline.
function mockBackground(): Buffer {
  const [w, h] = imageGenConfig.size.split('x').map(Number);
  const lines: string[] = [];
  for (let x = 0; x <= w; x += 64) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#16324F" stroke-width="1" opacity="0.25"/>`);
  for (let y = 0; y <= h; y += 64) lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#16324F" stroke-width="1" opacity="0.25"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0A1626"/><stop offset="1" stop-color="#12243B"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>${lines.join('')}</svg>`;
  return new Resvg(svg).render().asPng();
}

export async function getBackground(provider: ImageProvider, prompt: string): Promise<Buffer> {
  if (provider === 'openai') return openaiBackground(prompt);
  if (provider === 'mock') return mockBackground();
  throw new ProviderError('disabled', 'Visual generation is currently unavailable.');
}
