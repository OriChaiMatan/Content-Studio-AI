// Cinematic background prompt builder. Wraps the extracted visual intent in a
// keynote-grade (Apple/NVIDIA/OpenAI/Bloomberg) realism template. Colors are
// unrestricted; no generated text/logos/people; composition is free but overlay-safe.
// (Ported from the validated visual-prototype.)
export function buildBackgroundPrompt(visualIntent: string): string {
  return `Create a photorealistic cinematic scene representing:
${visualIntent}

Requirements: visually stunning, extremely impressive, dramatic scale, realistic, strong depth, premium cinematic quality, stop-scrolling impact, high emotional intensity, rich atmosphere, dynamic composition.

Visual style: intelligent, premium, modern, sophisticated — in the spirit of an Apple, NVIDIA, OpenAI, or Bloomberg keynote visual. Realistic but extraordinary. Photorealistic, not illustration, not cartoon, not abstract AI-art noise. NOT a Hollywood war poster, NOT fantasy art, NOT Netflix-trailer melodrama.
Prefer: vast large-scale environments, futuristic architecture, abstract physical systems, energy flows and fields, industrial or planetary scale, invisible forces becoming visible.
Use: dramatic lighting, strong contrast, atmospheric haze, volumetric light, particles, immense depth, epic but composed perspective.
Colors: completely free. Use whatever palette best serves the visual impact (blue, red, orange, purple, gold, dark monochrome, etc.). Do not restrict to any brand palette.

Composition: keep the composition suitable for a professional text overlay. Avoid placing the main focal point or the brightest visual detail across the entire frame, and avoid full-frame visual chaos. This does NOT mean empty negative space or a constrained, boring image: stay bold, dramatic, and full of depth, while leaving the scene readable enough for text to sit over part of it.

Strict guardrails (must NOT appear): real people or identifiable faces, recognizable public figures, soldiers, firefighters, lone hero figures, national flags, political or military symbols, weapons, castles, fortresses, lighthouses, medieval or fantasy motifs, brand or company logos, any readable text/words/letters/numbers, UI screens or dashboards, charts, watermarks.
Human figures should generally NOT appear; if one does it must be a generic, distant, non-identifiable anonymous silhouette, never the focal point.

Avoid: war or battle scenes, movie-poster melodrama, generic stock-photo look, flat composition, cartoon or illustration, abstract AI-art noise, cheap SaaS aesthetics.`;
}
