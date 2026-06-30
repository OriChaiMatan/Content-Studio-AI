import { getAnthropicClient, sourceAnalysisConfig } from '../../lib/anthropic';
import { removeEmDashes } from '../outputSanitizer';
import type { VisualBrief } from './visualBrief';

// ─────────────────────────────────────────────────────────────────────────────
// Visual Intelligence layer (Sprint 3). Sits between thesis extraction and prompt
// generation. ONE structured Claude call returns a visual PLAN, turning "generic
// cinematic AI art" into a thesis-driven editorial scene:
//   1. archetype     — the structural shape of the thesis
//   2. scene         — a SPECIFIC, concrete editorial scene (a visual argument)
//   3. palette       — color-harmony hint (exposed for future overlay accent matching)
//   4. anti-cliché   — banned imagery is hard-rejected (deterministic guarantee)
//   5. headline      — a compressed, high-impact editorial headline (post language)
// Never throws; falls back to deterministic classification + archetype scene.
// ─────────────────────────────────────────────────────────────────────────────

export const ARCHETYPES = [
  'power_shift', 'hidden_infrastructure', 'collapse_fragility',
  'race_acceleration', 'transformation', 'signal_vs_noise',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];
export type Palette = 'warm' | 'cool' | 'neutral' | 'high_contrast';
// Sprint 4.5 — lighting mode. Default is BRIGHT editorial; darkness is the exception.
export type LightingMode = 'bright_editorial' | 'balanced_contrast' | 'dark_dramatic';
export const LIGHTING_MODES: readonly LightingMode[] = ['bright_editorial', 'balanced_contrast', 'dark_dramatic'];

export interface VisualPlan {
  archetype: Archetype;
  scene: string;
  palette: Palette;
  lighting: LightingMode;
  accent: boolean; // Sprint 4.7 — headline is WHITE by default; true tints the punchline blue
  headline: string;
  source: string; // 'claude' | 'fallback:*'
}

// (3) Anti-cliché — hard-reject list. Applies to the SCENE (image), not the headline.
const CLICHE = /\b(soldiers?|battles?|warfare|fortress(es)?|castles?|lighthouses?|chess|robot faces?|neon cit(y|ies)|circuit[\s-]?boards?|glowing eyes|sci-?fi wallpaper|knights?|swords?)\b/i;

// (1) Deterministic archetype classification — fallback + when Claude is unavailable.
export function classifyArchetype(text: string): Archetype {
  const t = (text ?? '').toLowerCase();
  if (/\b(control|power|dominat|monopol|gatekeep|leverage|who (wins|owns|controls)|shift)\b/.test(t)) return 'power_shift';
  if (/\b(infrastructure|beneath|behind|hidden|underlying|plumbing|supply chain|foundation|substrate|pipes?)\b/.test(t)) return 'hidden_infrastructure';
  if (/\b(collapse|fragil|crisis|break|bubble|vulnerable|brittle|risk|strain|overload)\b/.test(t)) return 'collapse_fragility';
  if (/\b(race|faster|speed|accelerat|compete|sprint|momentum|outpace|relentless)\b/.test(t)) return 'race_acceleration';
  if (/\b(transform|becoming|evolv|reinvent|future of|redefin|shift(ing)? from|reshap)\b/.test(t)) return 'transformation';
  if (/\b(signal|noise|clarity|distraction|focus|hype|what (really )?matters|cut through)\b/.test(t)) return 'signal_vs_noise';
  return 'transformation';
}

// (4) Deterministic lighting classification. BRIGHT editorial is the strong default;
// dark_dramatic is reserved for theses that genuinely turn on secrecy/fraud/collapse.
// Note: "breach"/"crisis" alone do NOT force darkness — a resilience/containment framing
// is optimistic and should stay bright.
const DARK_TRIGGER = /\b(fraud|corrupt(ion)?|scandal|cover[\s-]?up|collapse|secrecy|secret(ly)?|systemic failure|hidden risk|embezzl|deceit|conceal)\b/i;
export function classifyLighting(text: string): LightingMode {
  return DARK_TRIGGER.test(text ?? '') ? 'dark_dramatic' : 'bright_editorial';
}

// Sprint 4.6 — humans are FORBIDDEN by default; allowed only when the thesis is
// explicitly about human dynamics (leadership, psychology, hiring, consumer behavior,
// interpersonal). Everything else → zero people.
const HUMAN_OK = /\b(leader|leadership|manager?s?|managing|team|hir(e|ing)|recruit|talent|employ|workforce|psycholog|behaviou?r|culture|interpersonal|customers?|consumers?|clients?|negotiat|empathy|mentor|coach)\b/i;
export function humansAllowed(domain: string, text: string): boolean {
  return domain === 'leadership' || HUMAN_OK.test(text ?? '');
}

// Concrete, cliché-free, BRIGHT fallback scene per archetype (used when Claude is
// unavailable or its scene tripped the anti-cliché filter). Bright/editorial by default.
const ARCHETYPE_SCENE: Record<Archetype, string> = {
  power_shift: 'a bright modern facility in clean daylight where one cluster of machines is clearly the busiest hub, every detail crisply visible',
  hidden_infrastructure: 'a clean, brightly lit architectural cutaway revealing the pipes, conduits and cabling beneath a modern facility in sharp daylight detail',
  collapse_fragility: 'a pristine modern structure in clear daylight with a single fine stress fracture spreading visibly across its otherwise flawless surface',
  race_acceleration: 'a bright, airy automated production line in natural daylight, components moving briskly with crisp, fully visible detail',
  transformation: 'a bright, sunlit production line where raw material visibly becomes a finished, refined product, every stage clearly lit',
  signal_vs_noise: 'a clean, brightly lit scene where one crisply ordered element stands out clearly against a lightly scattered background',
};

// (5) Deterministic headline compression fallback (used only when Claude is unavailable).
function compressFallback(brief: VisualBrief['fields']): string {
  const src = removeEmDashes(brief.hook || brief.thesis || brief.title || '').replace(/\s+/g, ' ').trim();
  const words = src.split(' ').filter(Boolean);
  return words.length > 12 ? words.slice(0, 12).join(' ') : src;
}

// Hard guarantee: a visual headline is at most 12 words (never truncated with "…";
// just clamped). Primary punchiness comes from the LLM (see SYSTEM headline rule).
function clampHeadline(s: string): string {
  const w = s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return w.length > 12 ? w.slice(0, 12).join(' ') : w.join(' ');
}

function fallbackPlan(brief: VisualBrief['fields'], reason: string): VisualPlan {
  const blob = `${brief.thesis ?? ''} ${brief.hook ?? ''} ${brief.title ?? ''}`;
  const archetype = classifyArchetype(blob);
  return { archetype, scene: ARCHETYPE_SCENE[archetype], palette: 'neutral', lighting: classifyLighting(blob), accent: false, headline: compressFallback(brief), source: `fallback:${reason}` };
}

const SYSTEM = `You are a visual intelligence director for a premium editorial brand — think The Economist, Bloomberg, or Stratechery cover art. Given a post's thesis, produce a STRUCTURED visual PLAN that turns the thesis into a visual ARGUMENT, not generic AI wallpaper.

Return ONLY a JSON object (no prose, no code fences):
{
  "archetype": one of "power_shift" | "hidden_infrastructure" | "collapse_fragility" | "race_acceleration" | "transformation" | "signal_vs_noise",
  "scene": a SPECIFIC, concrete editorial scene that makes the thesis visible. Name real-world objects/systems/places in the post's domain. It must be a literal scene a cinematographer could stage — NOT an abstract mood. 12-30 words, English.
  "palette": one of "warm" | "cool" | "neutral" | "high_contrast",
  "lighting": one of "bright_editorial" | "balanced_contrast" | "dark_dramatic",
  "accent": boolean — whether the headline should use a blue accent line. DEFAULT false (white). Set true ONLY when the headline has a clear punchline/CTA line AND the content is visionary or future-positive. For cyber, finance, enterprise or analysis content, almost always false (white).
  "headline": a PUNCHY, memorable editorial headline that works as a strong LinkedIn visual CTA — 4-8 words IDEAL, 12 words MAXIMUM, in the SAME language as the post. Title Case for English. It must be a crafted, shareable headline — NOT the thesis sentence reworded or cropped.
}

Headline examples:
- BAD (too long, just the sentence): "The real AI bottleneck is silicon, not algorithms" → GOOD: "Silicon Controls AI" or "Compute Beats Algorithms".
- BAD: "Traditional security can no longer protect modern enterprises" → GOOD: "Perimeter Security Is Dead".

Lighting rules (IMPORTANT — bright is the default; darkness is the exception):
- "bright_editorial" (DEFAULT, ~70% of posts): bright natural daylight, clean airy composition, high object visibility, optimistic and premium — like an Apple keynote or a Bloomberg/Financial Times cover.
- "balanced_contrast" (~25%): clearly lit with moderate, purposeful contrast and a focused highlight; objects still fully visible.
- "dark_dramatic" (RARE, ~5%): choose ONLY if the thesis genuinely turns on secrecy, fraud, corruption, collapse, systemic failure, or hidden risk. A breach/crisis framed around RESILIENCE or recovery is optimistic — keep it bright.
- Test every scene: "Would this still feel strong if brightly lit?" If no, the scene is too weak and leans on mood — pick a stronger, bright scene.

Scene rules:
- Be concrete and domain-specific. BAD: "glowing futuristic city". GOOD: "semiconductor fabrication lines feeding massive inference datacenters".
- Prefer BRIGHT, real-world environments: daylight, bright modern offices, well-lit industrial/lab spaces, clear interiors. Avoid dark, moody, night, or underexposed scenes unless lighting is "dark_dramatic".
- COMPOSITION-FIRST: compose so there is a naturally calm, uncluttered region (open sky, plain wall, glass, soft fog, blurred depth) where a headline can sit — the scene itself provides the negative space, never a dark overlay. Keep the key subject and most detail to one side.
- NEVER use these cliches: soldiers, battles, war imagery, fortresses, castles, lighthouses, chess, robot faces, neon cities, circuit-board macros, humans with glowing eyes, generic dark sci-fi wallpaper.
- PEOPLE: by default include ZERO people/humans/figures — describe the environment, system, or objects only. Include a person ONLY if the thesis is explicitly about human dynamics (leadership, psychology, hiring, consumer behavior, interpersonal); even then keep them secondary and non-identifiable. This should feel like premium editorial cover art, not stock photography or an ad.
- No text, words, logos, UI, or readable signage in the scene. No brands.
- The archetype must match the thesis's structural shape; the scene must embody that archetype.`;

function parseJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>; } catch { return null; }
}

export async function analyzeVisual(brief: VisualBrief['fields'], domain: string): Promise<VisualPlan> {
  const client = getAnthropicClient();
  if (!client) return fallbackPlan(brief, 'no-client');

  const userMsg = [
    brief.thesis && `Thesis: ${brief.thesis}`,
    brief.reframe && `Angle: ${brief.reframe}`,
    brief.hook && `Hook: ${brief.hook}`,
    brief.keyInsight && `Key insight: ${brief.keyInsight}`,
    brief.title && `Title: ${brief.title}`,
    `Domain: ${domain}`,
    `Post language: ${brief.lang}`,
    'Return the visual PLAN as JSON only.',
  ].filter(Boolean).join('\n');

  try {
    const msg = await client.messages.create({
      model: sourceAnalysisConfig.model,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ');
    const json = parseJson(text);
    if (!json) return fallbackPlan(brief, 'parse');

    const fb = fallbackPlan(brief, 'partial');
    const archetype = (ARCHETYPES as readonly string[]).includes(String(json.archetype)) ? json.archetype as Archetype : fb.archetype;
    let scene = typeof json.scene === 'string' && json.scene.trim() ? json.scene.trim() : fb.scene;
    // (3) Hard anti-cliché guarantee: if the model slipped in a banned motif, swap to
    // the deterministic archetype scene.
    if (CLICHE.test(scene)) scene = ARCHETYPE_SCENE[archetype];
    const palette: Palette = (['warm', 'cool', 'neutral', 'high_contrast'] as string[]).includes(String(json.palette)) ? json.palette as Palette : 'neutral';
    const lighting: LightingMode = (LIGHTING_MODES as string[]).includes(String(json.lighting)) ? json.lighting as LightingMode : fb.lighting;
    const accent = json.accent === true;
    const headline = clampHeadline(typeof json.headline === 'string' && json.headline.trim() ? removeEmDashes(json.headline.trim()) : fb.headline);

    return { archetype, scene, palette, lighting, accent, headline, source: 'claude' };
  } catch {
    return fallbackPlan(brief, 'error');
  }
}
