// Phase 1 (prototype) — Visual Intent extraction.
// ONE small Claude call. Input = whitelisted structured fields only (thesis, angle,
// hook, key insight, title). Output = ONE short cinematic visual-concept sentence.
// It must NOT produce overlay text, layout, styling, full prompt, colors, or typography.
// Deterministic fallback to the thesis if the call is unavailable/fails. Never throws.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KEY = (() => {
  try {
    const l = fs.readFileSync(path.resolve(DIR, '../backend/.env'), 'utf8').split('\n').find(x => x.startsWith('ANTHROPIC_API_KEY='));
    return l ? l.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
})();

const MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You are a visual concept director for a premium technology brand. Think Apple, NVIDIA, OpenAI, and Bloomberg keynote visuals.
Given a post's core idea, distill it into ONE short VISUAL CONCEPT — a place, system, or phenomenon that could become a stop-scrolling, intelligent, sophisticated background image.

The concept must be a SCENE or SYSTEM, never a character or story. Prefer:
- vast large-scale environments
- futuristic architecture
- abstract physical systems
- energy flows and fields
- industrial / planetary scale
- invisible forces becoming visible
- realistic but extraordinary scenes

Hard avoids (these read as cheap movie-poster clichés — never use them):
- soldiers, war, battles, military, weapons, flags, political symbols
- firefighters, lone heroes, any single human protagonist or figure
- castles, fortresses, lighthouses, knights, medieval or fantasy motifs
- Hollywood / fantasy / Netflix-trailer melodrama

Rules:
- Output EXACTLY ONE sentence, 8 to 18 words. No preamble, no quotes, no lists, no trailing notes.
- Describe the environment/system and its scale or energy, NOT the literal business topic, and NOT a human story.
- Write the concept in ENGLISH even if the post is in another language (it feeds an English image model).
- Do NOT include: overlay/headline text, layout, composition directions, camera/lens terms, color choices, typography, medium words (photo/render/illustration), logos, or UI.
- Output ONLY the visual concept sentence.

Example input thesis: "The real AI war is happening at inference."
Example output: Endless luminous data corridors converging into a vast architectural core of pure computation.`;

// Strip to a single clean sentence and cap length.
function clean(text, fallback) {
  let s = (text ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim();
  s = s.replace(/—/g, ', '); // no em dashes
  if (!s) return fallback;
  const words = s.split(/\s+/);
  if (words.length > 24) s = words.slice(0, 24).join(' ');
  return s.replace(/[.\s]+$/, '') + '.';
}

export async function extractVisualIntent(fields) {
  const thesisFallback = clean((fields.thesis || fields.title || 'A bold, cinematic idea').replace(/\.$/, ''), 'A bold, cinematic idea.');
  // Whitelist only — CTA, hashtags, footer, body are never passed.
  const userMsg = [
    fields.thesis && `Thesis: ${fields.thesis}`,
    fields.reframe && `Angle: ${fields.reframe}`,
    fields.hook && `Hook: ${fields.hook}`,
    fields.keyInsight && `Key insight: ${fields.keyInsight}`,
    fields.title && `Title: ${fields.title}`,
    `Post language: ${fields.lang || 'en'}`,
    'Return ONE cinematic visual concept sentence (English).',
  ].filter(Boolean).join('\n');

  if (!KEY) return { intent: thesisFallback, source: 'fallback:no-key' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 80, system: SYSTEM, messages: [{ role: 'user', content: userMsg }] }),
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    if (!res.ok) return { intent: thesisFallback, source: `fallback:http-${res.status}` };
    const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
    return { intent: clean(text, thesisFallback), source: 'claude' };
  } catch (e) {
    return { intent: thesisFallback, source: `fallback:${e.name}` };
  }
}
