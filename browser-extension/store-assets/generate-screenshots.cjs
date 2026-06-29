// Generates Chrome Web Store marketing screenshots for the LumAI extension as SVG.
// Design space is 1280x800, but each SVG is authored in a 1280x1280 square with the
// design vertically centered (translate y=240). qlmanage rasterizes square->square
// cleanly; a `sips` center-crop to 1280x800 then lands exactly on the design region.
// (qlmanage pads non-square SVGs to a square, so we avoid that entirely.)
//
// Colors match the LumAI design system:
//   primary #094CB2 · ink #0F172A · muted #64748B · faint #94A3B8
//   surface #F8FAFC · border #E5E7EB · tint #EFF4FC · green #16A34A
const fs = require('fs');
const path = require('path');

const W = 1280, H = 800;
const PRIMARY = '#094CB2', INK = '#0F172A', MUTED = '#64748B', FAINT = '#94A3B8';
const SURFACE = '#F8FAFC', BORDER = '#E5E7EB', TINT = '#EFF4FC', GREEN = '#16A34A';
const FONT = "-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif";

// LumAI mark inside a white rounded "chip" (with border so it reads on white bg).
function markChip(x, y, size) {
  const s = size / 128;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <rect width="128" height="128" rx="28" fill="#FFFFFF" stroke="${BORDER}" stroke-width="3"/>
    <path d="M24 36V104H92" stroke="${PRIMARY}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${PRIMARY}"/>
  </g>`;
}
// Bare blue LumAI glyph (no chip) — for placing inside a tinted circle.
function markGlyph(x, y, size) {
  const s = size / 128;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M24 36V104H92" stroke="${PRIMARY}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${PRIMARY}"/>
  </g>`;
}

function frame(defs, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 1280" width="1280" height="1280" font-family="${FONT}">
  <defs>${defs}</defs>
  <rect width="1280" height="1280" fill="#FFFFFF"/>
  <g transform="translate(0,240)">${content}</g>
</svg>`;
}

const bgGradient = `<linearGradient id="bg" x1="0" y1="0" x2="1280" y2="800" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="1" stop-color="#E9F1FC"/>
  </linearGradient>`;

const bg = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1170" cy="700" r="280" fill="${PRIMARY}" opacity="0.04"/>
  <circle cx="90" cy="40" r="170" fill="${PRIMARY}" opacity="0.035"/>`;

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot 1 — popup over a browser window
// ─────────────────────────────────────────────────────────────────────────────
function screenshot1() {
  // Browser window
  const winX = 690, winY = 120, winW = 510, winH = 540, r = 16;
  const toolbar = `M${winX + r},${winY} h${winW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v32 h-${winW} v-32 a${r},${r} 0 0 1 ${r},-${r} z`;

  // Popup card geometry
  const px = 840, py = 168, pw = 336, ph = 414;
  const pad = 22, fieldX = px + pad, fieldW = pw - 2 * pad;

  const field = (labelY, label, boxY, render) => `
    <text x="${fieldX}" y="${labelY}" font-size="11" font-weight="700" letter-spacing="0.8" fill="${FAINT}">${label}</text>
    ${render(boxY)}`;

  return frame(bgGradient, `
  ${bg}

  <!-- Left: brand + copy -->
  ${markChip(80, 70, 46)}
  <text x="140" y="103" font-size="29" font-weight="700" fill="${PRIMARY}">LumAI</text>

  <text x="80" y="300" font-size="54" font-weight="800" fill="${INK}">
    <tspan x="80" dy="0">Save sources to LumAI</tspan>
    <tspan x="80" dy="64">in one click</tspan>
  </text>

  <text x="80" y="450" font-size="21" fill="${MUTED}">
    <tspan x="80" dy="0">Capture the current page URL and title, then save</tspan>
    <tspan x="80" dy="30">it directly into a LumAI content case.</tspan>
  </text>

  <!-- trust pill -->
  <rect x="80" y="520" width="312" height="40" rx="20" fill="${TINT}"/>
  <circle cx="104" cy="540" r="9" fill="${PRIMARY}"/>
  <path d="M100 540 l3 3 l5 -6" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="122" y="545" font-size="14" font-weight="600" fill="${PRIMARY}">Saves the page URL + title only</text>

  <!-- Browser window shadow + frame -->
  <rect x="${winX + 6}" y="${winY + 16}" width="${winW}" height="${winH}" rx="${r}" fill="#0F172A" opacity="0.10"/>
  <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="${r}" fill="#FFFFFF" stroke="${BORDER}" stroke-width="1.5"/>
  <path d="${toolbar}" fill="${SURFACE}"/>
  <line x1="${winX}" y1="${winY + 48}" x2="${winX + winW}" y2="${winY + 48}" stroke="${BORDER}" stroke-width="1.5"/>
  <circle cx="${winX + 24}" cy="${winY + 24}" r="6" fill="#FF5F57"/>
  <circle cx="${winX + 44}" cy="${winY + 24}" r="6" fill="#FEBC2E"/>
  <circle cx="${winX + 64}" cy="${winY + 24}" r="6" fill="#28C840"/>
  <!-- address bar -->
  <rect x="${winX + 96}" y="${winY + 12}" width="300" height="24" rx="12" fill="#FFFFFF" stroke="${BORDER}"/>
  <circle cx="${winX + 112}" cy="${winY + 24}" r="4" fill="${FAINT}"/>
  <text x="${winX + 126}" y="${winY + 28}" font-size="12" fill="${MUTED}">example.com/blog/marketing-trends</text>
  <!-- highlighted extension icon -->
  <rect x="${winX + 446}" y="${winY + 10}" width="30" height="28" rx="8" fill="${TINT}"/>
  ${markGlyph(winX + 450, winY + 14, 22)}

  <!-- faint article content -->
  <rect x="${winX + 36}" y="${winY + 84}" width="300" height="22" rx="6" fill="#E2E8F0"/>
  <rect x="${winX + 36}" y="${winY + 120}" width="190" height="14" rx="6" fill="#EEF2F7"/>
  <rect x="${winX + 36}" y="${winY + 156}" width="${winW - 72}" height="130" rx="10" fill="#F1F5F9"/>
  <circle cx="${winX + 90}" cy="${winY + 245}" r="14" fill="#E2E8F0"/>
  <path d="M${winX + 120} ${winY + 268} l40 -46 l34 40 l24 -22 l44 28" stroke="#E2E8F0" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${[0, 1, 2, 3].map(i => `<rect x="${winX + 36}" y="${winY + 312 + i * 24}" width="${[420, 400, 430, 300][i]}" height="11" rx="5" fill="#EEF2F7"/>`).join('')}

  <!-- Popup card (floating) -->
  <rect x="${px}" y="${py + 12}" width="${pw}" height="${ph}" rx="18" fill="#0F172A" opacity="0.14"/>
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="18" fill="#FFFFFF" stroke="#E7EAF0" stroke-width="1.5"/>

  <!-- popup header -->
  ${markChip(px + pad, py + 20, 26)}
  <text x="${px + pad + 36}" y="${py + 39}" font-size="15" font-weight="700" fill="${INK}">LumAI</text>
  <circle cx="${px + pw - 34}" cy="${py + 33}" r="10" fill="none" stroke="${BORDER}" stroke-width="2"/>
  <circle cx="${px + pw - 34}" cy="${py + 33}" r="3" fill="${FAINT}"/>
  <line x1="${px + pad}" y1="${py + 62}" x2="${px + pw - pad}" y2="${py + 62}" stroke="${BORDER}"/>

  <text x="${px + pad}" y="${py + 92}" font-size="16" font-weight="700" fill="${INK}">Save source to LumAI</text>
  <text x="${px + pad}" y="${py + 114}" font-size="13" fill="${MUTED}">Add this page to one of your content cases.</text>

  ${field(py + 152, 'TITLE', py + 160, (by) => `
    <rect x="${fieldX}" y="${by}" width="${fieldW}" height="38" rx="10" fill="${SURFACE}" stroke="${BORDER}"/>
    <text x="${fieldX + 14}" y="${by + 24}" font-size="13" fill="${INK}">AI marketing trends for 2026</text>`)}

  ${field(py + 212, 'URL', py + 220, (by) => `
    <rect x="${fieldX}" y="${by}" width="${fieldW}" height="38" rx="10" fill="${SURFACE}" stroke="${BORDER}"/>
    <text x="${fieldX + 14}" y="${by + 24}" font-size="13" fill="${PRIMARY}">example.com/blog/marketing-trends</text>`)}

  ${field(py + 272, 'CASE', py + 280, (by) => `
    <rect x="${fieldX}" y="${by}" width="${fieldW}" height="40" rx="10" fill="#FFFFFF" stroke="${BORDER}"/>
    <path d="M${fieldX + 14} ${by + 15} h10 l3 4 h13 v11 h-26 z" fill="none" stroke="${PRIMARY}" stroke-width="1.6" stroke-linejoin="round"/>
    <text x="${fieldX + 44}" y="${by + 25}" font-size="13" fill="${INK}">Marketing Q3 Campaign</text>
    <path d="M${fieldX + fieldW - 26} ${by + 17} l6 6 l6 -6" stroke="${MUTED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}

  <!-- save button -->
  <rect x="${fieldX}" y="${py + 338}" width="${fieldW}" height="44" rx="12" fill="${PRIMARY}"/>
  <path d="M${px + pw / 2 - 56} ${py + 352} v14 l5 -4 l5 4 v-14 z" fill="#FFFFFF" opacity="0.95"/>
  <text x="${px + pw / 2 + 6}" y="${py + 366}" font-size="15" font-weight="700" fill="#FFFFFF" text-anchor="middle">Save source</text>

  <circle cx="${fieldX + 5}" cy="${py + 402}" r="4" fill="${GREEN}"/>
  <text x="${fieldX + 18}" y="${py + 407}" font-size="12" fill="${MUTED}">Connected to LumAI</text>
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot 2 — 3-step workflow
// ─────────────────────────────────────────────────────────────────────────────
function screenshot2() {
  const cardW = 320, cardH = 300, gap = 40, cardY = 330;
  const startX = (W - (3 * cardW + 2 * gap)) / 2; // 120
  const xs = [startX, startX + cardW + gap, startX + 2 * (cardW + gap)];

  const icons = [
    // globe
    (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${PRIMARY}" stroke-width="2.6"/>
      <ellipse cx="${cx}" cy="${cy}" rx="9" ry="20" fill="none" stroke="${PRIMARY}" stroke-width="2.6"/>
      <line x1="${cx - 20}" y1="${cy}" x2="${cx + 20}" y2="${cy}" stroke="${PRIMARY}" stroke-width="2.6"/>
      <line x1="${cx - 17}" y1="${cy - 10}" x2="${cx + 17}" y2="${cy - 10}" stroke="${PRIMARY}" stroke-width="2"/>
      <line x1="${cx - 17}" y1="${cy + 10}" x2="${cx + 17}" y2="${cy + 10}" stroke="${PRIMARY}" stroke-width="2"/>`,
    // folder
    (cx, cy) => `<path d="M${cx - 22} ${cy - 14} h14 l5 6 h25 v22 h-44 z" fill="#DCE7F7" stroke="${PRIMARY}" stroke-width="2.4" stroke-linejoin="round"/>`,
    // LumAI mark glyph (Save to LumAI)
    (cx, cy) => markGlyph(cx - 21, cy - 21, 42),
  ];

  const steps = [
    { t: 'Find an article', d: ['Open any webpage', 'you want to keep.'] },
    { t: 'Choose a case', d: ['Pick the LumAI content', 'case to save it to.'] },
    { t: 'Save to LumAI', d: ['One click adds the', 'page URL + title.'] },
  ];

  const cards = xs.map((x, i) => {
    const cx = x + cardW / 2;
    return `
    <rect x="${x}" y="${cardY + 8}" width="${cardW}" height="${cardH}" rx="22" fill="#0F172A" opacity="0.06"/>
    <rect x="${x}" y="${cardY}" width="${cardW}" height="${cardH}" rx="22" fill="#FFFFFF" stroke="#E9EDF3" stroke-width="1.5"/>
    <circle cx="${x + 36}" cy="${cardY + 40}" r="17" fill="${PRIMARY}"/>
    <text x="${x + 36}" y="${cardY + 46}" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle">${i + 1}</text>
    <circle cx="${cx}" cy="${cardY + 118}" r="42" fill="${TINT}"/>
    ${icons[i](cx, cardY + 118)}
    <text x="${cx}" y="${cardY + 200}" font-size="22" font-weight="700" fill="${INK}" text-anchor="middle">${steps[i].t}</text>
    <text x="${cx}" y="${cardY + 234}" font-size="15" fill="${MUTED}" text-anchor="middle">
      <tspan x="${cx}" dy="0">${steps[i].d[0]}</tspan>
      <tspan x="${cx}" dy="22">${steps[i].d[1]}</tspan>
    </text>`;
  }).join('');

  // chevron connectors in the gaps
  const conn = [xs[0] + cardW + gap / 2, xs[1] + cardW + gap / 2].map(gx =>
    `<path d="M${gx - 6} ${cardY + 110} l10 8 l-10 8" stroke="${PRIMARY}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`
  ).join('');

  return frame(bgGradient, `
  ${bg}

  ${markChip(80, 64, 44)}
  <text x="136" y="95" font-size="28" font-weight="700" fill="${PRIMARY}">LumAI</text>

  <text x="640" y="186" font-size="42" font-weight="800" fill="${INK}" text-anchor="middle">Turn research into structured content sources</text>
  <text x="640" y="232" font-size="20" fill="${MUTED}" text-anchor="middle">Collect articles, posts, and webpages into your LumAI workspace without leaving the browser.</text>

  ${cards}
  ${conn}

  <rect x="${640 - 200}" y="690" width="400" height="44" rx="22" fill="${TINT}"/>
  <circle cx="${640 - 168}" cy="712" r="9" fill="${PRIMARY}"/>
  <path d="M${640 - 172} 712 l3 3 l5 -6" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${640 + 6}" y="717" font-size="15" font-weight="600" fill="${PRIMARY}" text-anchor="middle">Captures the page URL + title only — no tracking</text>
  `);
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'screenshot-1.svg'), screenshot1());
fs.writeFileSync(path.join(outDir, 'screenshot-2.svg'), screenshot2());
console.log('wrote screenshot-1.svg, screenshot-2.svg');
