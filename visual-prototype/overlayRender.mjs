// Phase 1 (prototype) — LumAI overlay renderer (Satori -> resvg).
// Renders ALL text/logo. Stronger, localized side-scrim so white headline + blue
// emphasis stay readable over ANY background color (colors are now unrestricted),
// while the opposite ~40% of the frame stays vivid. EN (LTR) + HE (RTL).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const FONT_BOLD = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const FONTS = [{ name: 'Arial', data: FONT_BOLD, weight: 700, style: 'normal' }];
const EMPHASIS = '#4DA3FF';
export const PLATFORMS = { linkedin: [1200, 627], facebook: [1200, 630] };

const MARK = (size) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${EMPHASIS}"/></svg>`;
  return { type: 'img', props: { width: size, height: size, src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` } };
};

// Stronger localized scrim — guarantees contrast for white text over any palette.
function scrimFor(side) {
  const stops = 'rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 24%, rgba(0,0,0,0.45) 46%, rgba(0,0,0,0) 64%';
  return `linear-gradient(${side === 'right' ? 270 : 90}deg, ${stops})`;
}

export async function renderFinal({ bgPath, overlay, platform }) {
  const [W, H] = PLATFORMS[platform];
  const isRTL = overlay.dir === 'rtl';
  const side = isRTL ? 'right' : 'left';
  const bgB64 = fs.readFileSync(bgPath).toString('base64');

  const node = { type: 'div', props: { style: { display: 'flex', width: `${W}px`, height: `${H}px`, position: 'relative', fontFamily: 'Arial' }, children: [
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`,
        backgroundImage: `url(data:image/png;base64,${bgB64})`, backgroundSize: 'cover', backgroundPosition: `${side} center` } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: scrimFor(side) } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, [side]: '0px', height: `${H}px`, width: '66%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: isRTL ? 'flex-end' : 'flex-start', textAlign: isRTL ? 'right' : 'left', padding: '56px 60px', direction: overlay.dir || 'ltr' },
      children: [
        { type: 'div', props: { style: { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: EMPHASIS, marginBottom: '20px', direction: overlay.dir || 'ltr' }, children: overlay.kicker } },
        ...overlay.lines.map((line, i) => ({ type: 'div', props: { style: { display: 'flex', fontSize: 66, fontWeight: 700, lineHeight: 1.04, color: i === overlay.emphasisLine ? EMPHASIS : '#FFFFFF', direction: overlay.dir || 'ltr' }, children: line } })),
      ] } },
    { type: 'div', props: { style: { position: 'absolute', bottom: '40px', [side]: '60px', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '12px' },
      children: [MARK(34), { type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#FFFFFF' }, children: 'LumAI' } }] } },
  ] } };

  const svg = await satori(node, { width: W, height: H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
