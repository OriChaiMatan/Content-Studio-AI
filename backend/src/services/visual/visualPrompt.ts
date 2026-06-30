import type { LightingMode } from './visualIntelligence';

// Editorial background prompt builder. Wraps the Visual Intelligence SCENE (a concrete,
// thesis-driven scene) in a premium editorial template. Sprint 4.5: BRIGHT, clean,
// editorial is the DEFAULT; darkness is the exception (only `dark_dramatic`). Colors are
// unrestricted; no generated text/logos/people; composition is free but overlay-safe.

const LIGHTING_DIRECTIVE: Record<LightingMode, string> = {
  bright_editorial:
    'Lighting: BRIGHT, natural daylight, clean and airy. Every object clearly visible with high detail. Optimistic, confident, premium and modern — like an Apple keynote, a Bloomberg cover, or a Financial Times visual essay. NOT dark, NOT moody, NOT a night scene, NOT underexposed, NOT a movie poster.',
  balanced_contrast:
    'Lighting: clearly lit with moderate, purposeful contrast and a focused highlight. Objects remain fully visible and detailed. Premium editorial — never dark, murky, or underexposed.',
  dark_dramatic:
    'Lighting: deliberately darker and dramatic to convey the subject\'s weight (secrecy / risk / failure), but still clean, premium and readable — key objects clearly visible, never horror, never black-dominant to the point of hiding detail.',
};

export function buildBackgroundPrompt(scene: string, archetype?: string, lighting: LightingMode = 'bright_editorial', allowHumans = false, textSide: 'left' | 'right' = 'left'): string {
  const frame = archetype ? `\nStructural archetype (the visual argument): ${archetype.replace(/_/g, ' ')}.` : '';
  const bright = lighting !== 'dark_dramatic';
  const people = allowHumans
    ? 'People: include a person ONLY if essential to the idea; keep them secondary and non-identifiable (no faces of real or recognizable people), never the sole focus.'
    : 'People: NONE. Absolutely no people, humans, figures, silhouettes, hands, body parts, faces, or crowds anywhere in the image — show only the environment, systems, and objects. This is premium editorial cover art, not stock photography.';
  return `Create a photorealistic, premium editorial scene that visually argues this idea:
${scene}${frame}

Requirements: visually striking, premium editorial quality, clean and clear composition, strong sense of depth, HIGH object visibility with crisp detail in every important element, realistic real-world environment, modern and intelligent. The scene must be specific and concrete — a real place/system, never an abstract mood or generic wallpaper. It must read instantly at a glance.

${LIGHTING_DIRECTIVE[lighting]}

Visual style: premium editorial — in the spirit of an Apple keynote, Bloomberg/Financial Times covers, OpenAI launch visuals, or high-end B2B SaaS branding. Photorealistic, real-world, not illustration, not cartoon, not abstract AI-art noise, not sci-fi.
Colors: free — use whatever palette best serves the scene${bright ? ', but keep the overall image bright and well-exposed' : ''}. Do not restrict to any brand palette.

Composition (design the headline space INTO the scene — think magazine cover, NOT a banner with an overlay): reserve a calm, uncluttered area on the ${textSide.toUpperCase()} side of the frame where a WHITE headline will sit and read clearly WITHOUT any added overlay, scrim, gradient, vignette, or darkening. Make that area a naturally quiet region — open sky, a plain or softly-shadowed wall, tinted glass, soft fog, or a blurred depth-of-field zone — kept mid-to-deep in tone (NOT pure white, NOT busy) so white text is legible against it on its own. Keep the thesis's key subject and the most detailed elements on the opposite (${(textSide === 'left' ? 'right' : 'left')}) side. Keep real depth and a clear focal subject; the headline must feel native to the scene, not pasted on.

Strict guardrails (must NOT appear): recognizable public figures, soldiers, firefighters, lone hero figures, national flags, political or military symbols, weapons, castles, fortresses, lighthouses, knights, swords, medieval or fantasy motifs, chess, robot faces, humans with glowing eyes, neon cities, circuit-board macros, generic sci-fi wallpaper, warning/hazard symbols, brand or company logos, any readable text/words/letters/numbers, UI screens or dashboards, charts, watermarks.
${people}
ZERO TEXT (critical): the image must contain NO text of any kind — no signage, labels, lettering, captions, readable words, letters or numbers anywhere; no text on walls, screens, monitors, doors, glass, documents, boxes, racks, or equipment; no warning labels, no interface/UI text, no brand names or logos. Every surface, screen and panel is completely blank. (Earlier renders wrongly added words like "QUARANTINE" and "BANK" — never do this.)

Avoid${bright ? ' (this is a BRIGHT editorial image)' : ''}: ${bright ? 'dark cinematic scenes, low-key lighting, heavy shadows, black-dominant frames, night scenes, underexposure, orange-on-black sci-fi looks, horror/thriller mood, movie-poster energy, ' : ''}generic stock-photo look, flat composition, cartoon or illustration, abstract AI-art noise, cheap SaaS aesthetics.`;
}
