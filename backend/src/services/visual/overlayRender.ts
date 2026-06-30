import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { imageGenConfig } from '../../lib/visualConfig';
import type { OverlaySpec } from './visualBrief';

// Satori is ESM-only; the backend compiles to CommonJS. This Function-wrapped import
// stays a native dynamic import at runtime (tsc won't downlevel it to require()).
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<{ default: unknown }>;

const EMPHASIS = '#4DA3FF';
export const PLATFORM_SIZES: Record<string, [number, number]> = {
  linkedin: [1200, 627],
  facebook: [1200, 630],
};

let fontsCache: Array<{ name: string; data: Buffer; weight: number; style: 'normal' }> | null = null;
function loadFonts() {
  if (fontsCache) return fontsCache;
  const bold = path.join(imageGenConfig.fontsDir, 'Bold.ttf');
  const reg = path.join(imageGenConfig.fontsDir, 'Regular.ttf');
  if (!fs.existsSync(bold)) throw new Error(`overlay fonts missing in ${imageGenConfig.fontsDir} (need Bold.ttf, Regular.ttf)`);
  const fonts: Array<{ name: string; data: Buffer; weight: number; style: 'normal' }> = [
    { name: 'Brand', data: fs.readFileSync(bold), weight: 700, style: 'normal' },
  ];
  if (fs.existsSync(reg)) fonts.push({ name: 'Brand', data: fs.readFileSync(reg), weight: 400, style: 'normal' });
  fontsCache = fonts;
  return fonts;
}

function lumaiMark(size: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${EMPHASIS}"/></svg>`;
  return { type: 'img', props: { width: size, height: size, src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` } };
}

// Strong localized side-scrim — guarantees white/blue text contrast over ANY palette,
// while the opposite ~40% of the frame stays vivid.
function scrim(side: 'left' | 'right') {
  const stops = 'rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 24%, rgba(0,0,0,0.45) 46%, rgba(0,0,0,0) 64%';
  return `linear-gradient(${side === 'right' ? 270 : 90}deg, ${stops})`;
}

export async function renderOverlay(
  backgroundBytes: Buffer,
  overlay: OverlaySpec,
  platform: string,
): Promise<{ png: Buffer; width: number; height: number }> {
  const [W, H] = PLATFORM_SIZES[platform] ?? PLATFORM_SIZES.linkedin;
  const fonts = loadFonts();
  const isRTL = overlay.dir === 'rtl';
  const side: 'left' | 'right' = isRTL ? 'right' : 'left';
  const bgB64 = backgroundBytes.toString('base64');

  const node = { type: 'div', props: { style: { display: 'flex', width: `${W}px`, height: `${H}px`, position: 'relative', fontFamily: 'Brand' }, children: [
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: `url(data:image/png;base64,${bgB64})`, backgroundSize: 'cover', backgroundPosition: `${side} center` } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: scrim(side) } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, [side]: '0px', height: `${H}px`, width: '66%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: isRTL ? 'flex-end' : 'flex-start', textAlign: isRTL ? 'right' : 'left', padding: '56px 60px', direction: overlay.dir },
      children: [
        { type: 'div', props: { style: { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: EMPHASIS, marginBottom: '20px', direction: overlay.dir }, children: overlay.kicker } },
        ...overlay.lines.map((line, i) => ({ type: 'div', props: { style: { display: 'flex', fontSize: 66, fontWeight: 700, lineHeight: 1.04, color: i === overlay.emphasisLine ? EMPHASIS : '#FFFFFF', direction: overlay.dir }, children: line } })),
      ] } },
    { type: 'div', props: { style: { position: 'absolute', bottom: '40px', [side]: '60px', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '12px' },
      children: [lumaiMark(34), { type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#FFFFFF' }, children: 'LumAI' } }] } },
  ] } };

  const satori = (await esmImport('satori')).default as (n: unknown, o: unknown) => Promise<string>;
  const svg = await satori(node, { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return { png, width: W, height: H };
}
