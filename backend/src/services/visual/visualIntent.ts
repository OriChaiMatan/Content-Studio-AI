import { getAnthropicClient, sourceAnalysisConfig } from '../../lib/anthropic';
import { removeEmDashes } from '../outputSanitizer';
import type { VisualBrief } from './visualBrief';

// One small Claude call: distill the post into ONE cinematic VISUAL CONCEPT sentence.
// It must NOT produce overlay text, layout, styling, colors, or a full prompt — only
// a keynote-style scene/system concept. Deterministic thesis fallback; never throws.
const SYSTEM = `You are a visual concept director for a premium technology brand. Think Apple, NVIDIA, OpenAI, and Bloomberg keynote visuals.
Given a post's core idea, distill it into ONE short VISUAL CONCEPT — a place, system, or phenomenon that could become a stop-scrolling, intelligent, sophisticated background image.

The concept must be a SCENE or SYSTEM, never a character or story. Prefer: vast large-scale environments, futuristic architecture, abstract physical systems, energy flows and fields, industrial or planetary scale, invisible forces becoming visible, realistic but extraordinary scenes.

Hard avoids (cheap movie-poster cliches — never use): soldiers, war, battles, military, weapons, flags, political symbols, firefighters, lone heroes, any single human protagonist, castles, fortresses, lighthouses, knights, medieval or fantasy motifs, Hollywood/fantasy/Netflix melodrama.

Rules:
- Output EXACTLY ONE sentence, 8 to 18 words. No preamble, quotes, lists, or trailing notes.
- Describe the environment/system and its scale or energy, NOT the literal business topic, and NOT a human story.
- Write the concept in ENGLISH even if the post is in another language.
- Do NOT include overlay/headline text, layout, camera terms, color choices, typography, medium words, logos, or UI.
- Output ONLY the visual concept sentence.

Example input thesis: "The real AI war is happening at inference."
Example output: Endless luminous data corridors converging into a vast architectural core of pure computation.`;

function clean(text: string, fallback: string): string {
  let s = (text ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim();
  s = removeEmDashes(s);
  if (!s) return fallback;
  const words = s.split(/\s+/);
  if (words.length > 24) s = words.slice(0, 24).join(' ');
  return s.replace(/[.\s]+$/, '') + '.';
}

export async function extractVisualIntent(fields: VisualBrief['fields']): Promise<{ intent: string; source: string }> {
  const fallback = clean((fields.thesis || fields.title || 'A vast, intelligent, cinematic system').replace(/\.$/, ''), 'A vast, intelligent, cinematic system.');
  const client = getAnthropicClient();
  if (!client) return { intent: fallback, source: 'fallback:no-client' };

  const userMsg = [
    fields.thesis && `Thesis: ${fields.thesis}`,
    fields.reframe && `Angle: ${fields.reframe}`,
    fields.hook && `Hook: ${fields.hook}`,
    fields.keyInsight && `Key insight: ${fields.keyInsight}`,
    fields.title && `Title: ${fields.title}`,
    `Post language: ${fields.lang}`,
    'Return ONE cinematic visual concept sentence (English).',
  ].filter(Boolean).join('\n');

  try {
    const msg = await client.messages.create({
      model: sourceAnalysisConfig.model,
      max_tokens: 80,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ');
    return { intent: clean(text, fallback), source: 'claude' };
  } catch {
    return { intent: fallback, source: 'fallback:error' };
  }
}
