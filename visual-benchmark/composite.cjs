// Composite the deterministic LumAI overlay onto the REAL AI background (Version B).
// Embeds the real PNG as a data URI inside an SVG, draws a contrast scrim + crisp
// headline + brand lockup on top, and writes the SVG for qlmanage to rasterize.
const fs = require('fs');
const path = require('path');

const S = 1024;
const FONT = "-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif";
const bgB64 = fs.readFileSync(path.join(__dirname, 'B_background_real.png')).toString('base64');

const mark = (x, y, size) => {
  const s = size / 128;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="#5AB0FF"/>
  </g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" font-family="${FONT}">
  <defs>
    <linearGradient id="leftScrim" x1="0" y1="0" x2="${S}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#020814" stop-opacity="0.92"/>
      <stop offset="0.55" stop-color="#020814" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="${S}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#020814" stop-opacity="0.75"/>
      <stop offset="0.4" stop-color="#020814" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="botScrim" x1="0" y1="${S}" x2="0" y2="${S - 220}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#020814" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#020814" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <image x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${bgB64}"/>
  <rect width="${S}" height="${S}" fill="url(#leftScrim)"/>
  <rect width="${S}" height="${S}" fill="url(#topScrim)"/>
  <rect width="${S}" height="${S}" fill="url(#botScrim)"/>

  <text x="64" y="150" font-size="22" font-weight="700" fill="#5AB0FF" letter-spacing="6">AI INFRASTRUCTURE</text>
  <rect x="64" y="172" width="60" height="4" rx="2" fill="#5AB0FF"/>

  <text x="60" y="300" font-size="82" font-weight="800" fill="#FFFFFF" letter-spacing="0.5">The real AI war</text>
  <text x="60" y="392" font-size="82" font-weight="800" fill="#FFFFFF" letter-spacing="0.5">is happening at</text>
  <text x="60" y="484" font-size="82" font-weight="800" fill="#5AB0FF" letter-spacing="0.5">inference</text>

  ${mark(64, 906, 46)}
  <text x="124" y="942" font-size="30" font-weight="700" fill="#FFFFFF">LumAI</text>
  <line x1="64" y1="968" x2="960" y2="968" stroke="#FFFFFF" stroke-width="1" opacity="0.18"/>
  <text x="960" y="942" font-size="17" font-weight="600" fill="#9FC4F0" text-anchor="end" letter-spacing="2">LINKEDIN · 1024×1024</text>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'B_hybrid_final_real.svg'), svg);
console.log('wrote B_hybrid_final_real.svg');
