import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { imageGenConfig } from '../../lib/visualConfig';
import { isRtlText, type OverlaySpec } from './visualBrief';
import { LAYOUT_PRESETS, PALETTE, TYPO, resolveSides } from './lumaiDesign';
import { placeLabels } from './labelGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// Overlay renderer — REAL browser rendering (Playwright/Chromium). Composites the
// LumAI two-tier text block (charcoal headline + muted-grey supporting line) and any
// label chips over the AI background.
//
// Sprint 6 (LumAI Golden): the text-zone SIDE comes from the layout preset, NOT from
// RTL — RTL only controls alignment WITHIN the zone (so Hebrew can sit in a left zone,
// right-aligned, exactly like the golden reference). Chromium does Unicode bidi + Hebrew
// shaping natively; we pass logical-order text with dir="rtl"/lang="he" and never
// reverse strings. Heebo (Hebrew + Latin) is embedded as a data-URI @font-face.
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_SIZES: Record<string, [number, number]> = {
  linkedin: [1200, 627],
  facebook: [1200, 630],
};

let fontDataUri: string | null = null;
function heeboDataUri(): string {
  if (fontDataUri) return fontDataUri;
  const p = path.join(imageGenConfig.fontsDir, 'Heebo.ttf');
  if (!fs.existsSync(p)) throw new Error(`Hebrew-capable font missing: ${p} (expected Heebo.ttf)`);
  fontDataUri = `data:font/ttf;base64,${fs.readFileSync(p).toString('base64')}`;
  return fontDataUri;
}

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  }
  return browserPromise;
}
export async function closeRenderer(): Promise<void> {
  if (browserPromise) { const b = await browserPromise; await b.close(); browserPromise = null; }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(bgUri: string, overlay: OverlaySpec, W: number, H: number): string {
  const isRTL = overlay.dir === 'rtl';
  const preset = LAYOUT_PRESETS[overlay.layout] ?? LAYOUT_PRESETS.RIGHT_HEAVY;
  const { textSide } = resolveSides(overlay.layout, isRTL);
  const lang = isRTL ? 'he' : 'en';
  const alignItems = isRTL ? 'flex-end' : 'flex-start';
  const textAlign = isRTL ? 'right' : 'left';
  // Background is positioned so its focal (visual) side stays visible under the text zone.
  const bgPos = textSide === 'left' ? 'right' : 'left';

  const linesHtml = overlay.lines.map(l => `<div class="line">${esc(l)}</div>`).join('');
  const bodyHtml = overlay.body ? `<div class="body">${esc(overlay.body)}</div>` : '';

  // Sprint 6.2 — relational label chips: annotated NEAR each object's anchor zone, on the
  // requested side, guaranteed to avoid the text zone and each other; unsafe chips are
  // omitted (show=false) rather than drawn badly.
  const placements = placeLabels(overlay.labels, overlay.layout, isRTL, W, H);
  const chipsHtml = placements.filter(p => p.show).map(p => {
    const rtlChip = isRtlText(p.text);
    return `<div class="chip" dir="${rtlChip ? 'rtl' : 'ltr'}" style="left:${p.cxPct.toFixed(2)}%;top:${p.cyPct.toFixed(2)}%;">${esc(p.text)}</div>`;
  }).join('');

  return `<!doctype html><html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  @font-face{font-family:'Brand';src:url('${heeboDataUri()}') format('truetype');font-weight:100 900;font-display:block;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:${PALETTE.ground};}
  #stage{position:relative;width:${W}px;height:${H}px;font-family:${TYPO.family};}
  #bg{position:absolute;inset:0;background-image:url('${bgUri}');background-size:cover;background-position:${bgPos} center;}
  /* Text zone side + width come from the LAYOUT preset, not from RTL. */
  #text{position:absolute;top:0;${textSide}:0;height:${H}px;width:${preset.textZoneWidthPct}%;
    display:flex;flex-direction:column;justify-content:center;align-items:${alignItems};
    text-align:${textAlign};padding:56px 60px;direction:${isRTL ? 'rtl' : 'ltr'};}
  /* Sprint 10 — high-contrast editorial: pure-black extra-bold headline on white, a single
     red accent rule, lighter/smaller grey paragraph. No scrim; composition provides the space. */
  .line{font-weight:${TYPO.headlineWeight};line-height:${TYPO.headlineLineHeight};color:${PALETTE.anchor};
    letter-spacing:${TYPO.headlineTracking};white-space:nowrap;font-size:${TYPO.headlineSizePx}px;}
  .accent{width:60px;height:${TYPO.accentBarPx}px;background:${PALETTE.accent};margin:20px 0 0;border-radius:2px;}
  .body{margin-top:20px;font-weight:${TYPO.bodyWeight};font-size:${TYPO.bodySizePx}px;line-height:${TYPO.bodyLineHeight};
    color:${PALETTE.body};max-width:100%;}
  .chip{position:absolute;transform:translate(-50%,-50%);background:${PALETTE.chipBg};border:1px solid ${PALETTE.chipBorder};
    color:${PALETTE.chipText};font-size:${TYPO.chipSizePx}px;font-weight:${TYPO.chipWeight};line-height:1.2;
    padding:8px 14px;border-radius:10px;white-space:nowrap;box-shadow:0 6px 18px rgba(23,25,28,0.10);}
</style></head><body><div id="stage">
  <div id="bg"></div>
  <div id="text">${linesHtml}<div class="accent"></div>${bodyHtml}</div>
  ${chipsHtml}
</div></body></html>`;
}

// In-page auto-fit of the headline to the text column using real metrics, plus a
// LUMINANCE safety fallback: if the porcelain assumption is wrong and the text zone is
// actually dark, flip the charcoal text to white. No image darkening is ever added.
function adaptiveScript(W: number, H: number, textSide: 'left' | 'right', bgUri: string): string {
  return `(async () => {
  await document.fonts.ready;
  var text = document.getElementById('text');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.line'));
  if (!text || !lines.length) return;
  var cs = getComputedStyle(text);
  var avail = text.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var size = ${TYPO.headlineSizePx};
  var fits = function(){ return lines.every(function(l){ return l.scrollWidth <= avail; }); };
  while (size > ${TYPO.headlineMinPx} && !fits()) { size -= 1; lines.forEach(function(l){ l.style.fontSize = size + 'px'; }); }
  try {
    var img = new Image(); img.src = ${JSON.stringify(bgUri)}; await img.decode();
    var c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    var ctx = c.getContext('2d');
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var scale = Math.max(${W}/nw, ${H}/nh), sw = nw*scale, sh = nh*scale;
    var bgSide = ${JSON.stringify(textSide)} === 'left' ? 'right' : 'left';
    var dx = bgSide === 'left' ? 0 : (${W}-sw);
    var dy = (${H}-sh)/2;
    ctx.drawImage(img, dx, dy, sw, sh);
    var r = text.getBoundingClientRect();
    var rx = Math.max(0, Math.floor(r.left)), ry = Math.max(0, Math.floor(r.top));
    var rw = Math.max(1, Math.min(${W}-rx, Math.ceil(r.width))), rh = Math.max(1, Math.min(${H}-ry, Math.ceil(r.height)));
    var d = ctx.getImageData(rx, ry, rw, rh).data;
    var sum = 0, n = 0;
    for (var i = 0; i < d.length; i += 16) { sum += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]; n++; }
    var avg = n ? sum/n : 255;
    if (avg < 90) { // unexpectedly dark zone → flip to white for legibility
      lines.forEach(function(l){ l.style.color = '#FFFFFF'; l.style.textShadow = '0 1px 2px rgba(0,0,0,0.35)'; });
      var b = document.querySelector('.body'); if (b) { b.style.color = '#C9CDD3'; b.style.textShadow = '0 1px 2px rgba(0,0,0,0.30)'; }
    }
  } catch (e) { /* keep charcoal default on any sampling failure */ }
})()`;
}

export async function renderOverlay(
  backgroundBytes: Buffer,
  overlay: OverlaySpec,
  platform: string,
): Promise<{ png: Buffer; width: number; height: number }> {
  const [W, H] = PLATFORM_SIZES[platform] ?? PLATFORM_SIZES.linkedin;
  const isRTL = overlay.dir === 'rtl';
  const { textSide } = resolveSides(overlay.layout, isRTL);
  const bgUri = `data:image/png;base64,${backgroundBytes.toString('base64')}`;
  const html = buildHtml(bgUri, overlay, W, H);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(adaptiveScript(W, H, textSide, bgUri));
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    return { png, width: W, height: H };
  } finally {
    await page.close();
  }
}
