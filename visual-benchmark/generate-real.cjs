// REAL OpenAI image generation benchmark (gpt-image-1).
//  A: full poster WITH the headline text baked into the image.
//  B: background ONLY (no text) — LumAI overlay is composited separately.
// Reads OPENAI_API_KEY from backend/.env. Saves PNGs. Reports API errors verbatim.
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '../backend/.env');
const key = (() => {
  const line = fs.readFileSync(ENV_PATH, 'utf8').split('\n').find(l => l.startsWith('OPENAI_API_KEY='));
  if (!line) throw new Error('OPENAI_API_KEY not found in backend/.env');
  return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
})();

const HEADLINE = 'The real AI war is happening at inference';

const PROMPT_A =
  `A premium, cinematic B2B technology poster for LinkedIn, high-end SaaS aesthetic. ` +
  `Dark futuristic data center, deep blue cyber lighting, server racks receding in perspective, volumetric light, subtle bokeh. ` +
  `The poster prominently and clearly displays the exact headline text, spelled exactly: "${HEADLINE}". ` +
  `Bold modern sans-serif, professional poster layout, crisp perfectly legible typography, strong hierarchy. Sophisticated, minimal, no clutter.`;

const PROMPT_B =
  `A premium, cinematic B2B technology background image for LinkedIn, high-end SaaS aesthetic. ` +
  `Dark futuristic data center, deep blue cyber lighting, server racks receding in perspective, volumetric light, subtle bokeh. ` +
  `Absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks anywhere in the image. ` +
  `Leave clean, calm negative space in the upper-left third for a text overlay to be added later. Photoreal, sophisticated, minimal.`;

async function generate(label, prompt, outFile) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'high', n: 1 }),
      signal: ctrl.signal,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[${label}] HTTP ${res.status} after ${elapsed}s — ${JSON.stringify(json?.error ?? json)}`);
      return { ok: false, status: res.status, error: json?.error ?? json };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`[${label}] no b64_json in response: ${JSON.stringify(json).slice(0, 300)}`);
      return { ok: false, error: 'no_image' };
    }
    fs.writeFileSync(path.join(__dirname, outFile), Buffer.from(b64, 'base64'));
    console.log(`[${label}] OK in ${elapsed}s -> ${outFile} (${json?.usage ? JSON.stringify(json.usage) : 'no usage'})`);
    return { ok: true };
  } catch (e) {
    console.error(`[${label}] request failed: ${e.name} ${e.message}`);
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const which = process.argv[2] || 'both';
  if (which === 'A' || which === 'both') await generate('A full-poster', PROMPT_A, 'A_full_ai_real.png');
  if (which === 'B' || which === 'both') await generate('B background', PROMPT_B, 'B_background_real.png');
})();
