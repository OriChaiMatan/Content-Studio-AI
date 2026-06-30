// Visual benchmark: Full-AI Poster (A) vs Hybrid (B) for the same LinkedIn post.
// NOTE: api.openai.com is reachable here but no OPENAI_API_KEY is set, so a real
// diffusion call isn't possible. These are SIMULATIONS rendered as SVG -> PNG to
// illustrate the ARCHITECTURE difference (text reliability, layout control, brand,
// editability). They are NOT real model output: the "AI background" is an abstract
// stand-in (real gpt-image-1/FLUX output would be photoreal), and Version A's text
// defects illustrate the CHARACTERISTIC failure mode of baking text into a generated
// image (intermittent misspellings / kerning drift / gibberish sub-text). Modern
// gpt-image-1 is better at text than older models — see the writeup for that nuance.
const fs = require('fs');
const path = require('path');

const S = 1080;
const FONT = "-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif";

// ── Shared cinematic "AI infra" background (simulated) ───────────────────────
// negativeSpaceTop=true darkens the upper band (where the hybrid overlay text sits)
// and adds a contrast scrim — the deterministic legibility device the hybrid relies on.
function background(negativeSpaceTop) {
  const vpX = 540, vpY = 500; // vanishing point for the server-aisle perspective
  const floor = [];
  for (let i = -6; i <= 6; i++) {
    const x = vpX + i * 150;
    floor.push(`<line x1="${vpX}" y1="${vpY}" x2="${x}" y2="${S}" stroke="#1FB6FF" stroke-width="${1 + Math.abs(i) * 0.2}" opacity="${0.05 + Math.abs(i) * 0.012}"/>`);
  }
  // ceiling light strips
  const ceil = [];
  for (let i = -5; i <= 5; i++) {
    const x = vpX + i * 130;
    ceil.push(`<line x1="${vpX}" y1="${vpY}" x2="${x}" y2="0" stroke="#2DD4FF" stroke-width="1" opacity="${0.04 + Math.abs(i) * 0.01}"/>`);
  }
  // server racks (perspective rows of glowing LEDs) left & right of the aisle
  const racks = [];
  for (const side of [-1, 1]) {
    for (let d = 0; d < 6; d++) {
      const t = d / 6;
      const x = vpX + side * (90 + t * 430);
      const y = vpY + 20 + t * 360;
      const h = 60 + t * 230;
      const w = 16 + t * 70;
      racks.push(`<rect x="${x - (side < 0 ? w : 0)}" y="${y}" width="${w}" height="${h}" rx="4" fill="#0A1A33" stroke="#15406E" stroke-width="1" opacity="${0.55 - t * 0.15}"/>`);
      for (let k = 0; k < 5; k++) {
        const ly = y + 12 + k * (h - 20) / 5;
        const c = k % 2 ? '#22D3EE' : '#38BDF8';
        racks.push(`<circle cx="${x - (side < 0 ? w / 2 : -w / 2)}" cy="${ly}" r="${1.6 + t * 2}" fill="${c}" opacity="${0.5 - t * 0.1}"/>`);
      }
    }
  }
  // bokeh
  let bokeh = '';
  const seed = [[180,210,12],[920,160,9],[300,820,16],[800,760,11],[540,300,7],[660,540,6],[420,640,8],[760,300,5]];
  for (const [cx, cy, r] of seed) bokeh += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#7DD3FC" opacity="0.10"/>`;

  return `
    <rect width="${S}" height="${S}" fill="url(#bg)"/>
    <ellipse cx="540" cy="430" rx="620" ry="520" fill="url(#glow)"/>
    ${ceil.join('')}
    ${floor.join('')}
    ${racks.join('')}
    ${bokeh}
    <rect width="${S}" height="${S}" fill="url(#vignette)"/>
    ${negativeSpaceTop ? `<rect width="${S}" height="560" fill="url(#scrim)"/>` : ''}
  `;
}

const DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="${S}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#04070F"/>
    <stop offset="0.5" stop-color="#07162E"/>
    <stop offset="1" stop-color="#0A2E63"/>
  </linearGradient>
  <radialGradient id="glow" cx="540" cy="430" r="620" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1E6FD0" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#1E6FD0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="540" cy="540" r="760" gradientUnits="userSpaceOnUse">
    <stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.66"/>
  </radialGradient>
  <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="560" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#020610" stop-opacity="0.86"/>
    <stop offset="1" stop-color="#020610" stop-opacity="0"/>
  </linearGradient>
`;

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" font-family="${FONT}"><defs>${DEFS}</defs>${inner}</svg>`;
}

// LumAI mark (L + star) at (x,y) size px
function lumaiMark(x, y, size) {
  const s = size / 128;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="#5AB0FF"/>
  </g>`;
}

// ── Version A — FULL AI POSTER (simulated; text baked in by the "model") ─────
// Deliberately shows the characteristic full-AI artifacts: a misspelling, a doubled
// glyph, slightly drifting baseline/kerning, and gibberish sub-text in the "logo".
function posterA() {
  return svg(`
    ${background(false)}
    <!-- baked headline with simulated model text artifacts -->
    <g transform="rotate(-1.2 540 470)">
      <text x="540" y="430" font-size="78" font-weight="800" fill="#F4F8FF" text-anchor="middle" letter-spacing="1">The real AI war</text>
      <text x="548" y="520" font-size="78" font-weight="800" fill="#EAF2FF" text-anchor="middle" letter-spacing="3">is happening at infereence</text>
    </g>
    <!-- gibberish baked "logo" + tagline (typical generated sub-text) -->
    <text x="540" y="650" font-size="30" font-weight="700" fill="#7Fb8FF" text-anchor="middle" letter-spacing="6" opacity="0.9">LU?Al  STUDlO</text>
    <text x="540" y="690" font-size="18" font-weight="600" fill="#9Fc4F0" text-anchor="middle" letter-spacing="4" opacity="0.8">PREMIUM B2B · INFRENCE · SECURlTY</text>
    <text x="40" y="1050" font-size="14" fill="#8aa6c8" opacity="0.7">SIMULATED full-AI output — note baked text defects</text>
  `);
}

// ── Version B (background layer only) ────────────────────────────────────────
function hybridBg() {
  return svg(`${background(true)}
    <text x="40" y="1050" font-size="14" fill="#8aa6c8" opacity="0.7">SIMULATED AI background (no text) — negative space + scrim reserved for overlay</text>`);
}

// ── Version B — HYBRID FINAL (AI bg + deterministic LumAI overlay) ───────────
function hybridFinal() {
  return svg(`
    ${background(true)}
    <!-- kicker -->
    <text x="84" y="150" font-size="22" font-weight="700" fill="#5AB0FF" letter-spacing="6">AI INFRASTRUCTURE</text>
    <rect x="84" y="172" width="64" height="4" rx="2" fill="#5AB0FF"/>
    <!-- crisp, code-rendered headline -->
    <text x="80" y="278" font-size="86" font-weight="800" fill="#FFFFFF" letter-spacing="0.5">The real AI war</text>
    <text x="80" y="372" font-size="86" font-weight="800" fill="#FFFFFF" letter-spacing="0.5">is happening at</text>
    <text x="80" y="466" font-size="86" font-weight="800" fill="#5AB0FF" letter-spacing="0.5">inference</text>
    <!-- brand lockup bottom-left -->
    ${lumaiMark(80, 962, 46)}
    <text x="140" y="998" font-size="30" font-weight="700" fill="#FFFFFF">LumAI</text>
    <line x1="80" y1="1024" x2="1000" y2="1024" stroke="#FFFFFF" stroke-width="1" opacity="0.18"/>
    <text x="1000" y="998" font-size="18" font-weight="600" fill="#9Fc4F0" text-anchor="end" letter-spacing="2">LINKEDIN · 1080×1080</text>
  `);
}

const out = __dirname;
fs.writeFileSync(path.join(out, 'A_full_ai_poster.svg'), posterA());
fs.writeFileSync(path.join(out, 'B_hybrid_background.svg'), hybridBg());
fs.writeFileSync(path.join(out, 'B_hybrid_final.svg'), hybridFinal());
console.log('wrote A_full_ai_poster.svg, B_hybrid_background.svg, B_hybrid_final.svg');
