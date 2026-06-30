import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { imageGenConfig } from '../../lib/visualConfig';
import type { OverlaySpec } from './visualBrief';

// ─────────────────────────────────────────────────────────────────────────────
// Overlay renderer — REAL browser rendering (Playwright/Chromium).
//
// Replaces Satori/resvg: Satori's text engine did not reliably shape Hebrew RTL in
// the final raster (mixed Hebrew+Latin and bidi edge cases came out wrong), and it
// silently soft-wrapped long lines. Chromium is a full HTML/CSS engine — it does
// proper Unicode bidi + complex-script shaping natively, so we pass logical-order
// text with dir="rtl"/lang="he" and let the browser do the rest. NO manual string
// reversal, NO bidi hacks.
//
// Hebrew-capable font (Heebo: Hebrew + Latin) is embedded as a data-URI @font-face,
// so rendering is identical regardless of system fonts (dev or Railway/Linux).
// ─────────────────────────────────────────────────────────────────────────────

const EMPHASIS = '#4DA3FF';
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

// Lazy singleton browser, reused across renders. Closed via closeRenderer() (used by
// scripts; the long-lived server just keeps it warm).
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
  const side: 'left' | 'right' = isRTL ? 'right' : 'left';
  const lang = isRTL ? 'he' : 'en';
  // Sprint 4.7 — WHITE by default; tint a single line only when accentLine is set.
  const linesHtml = overlay.lines
    .map((l, i) => `<div class="line${overlay.accentLine !== null && i === overlay.accentLine ? ' emph' : ''}">${esc(l)}</div>`)
    .join('');
  return `<!doctype html><html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  @font-face{font-family:'Brand';src:url('${heeboDataUri()}') format('truetype');font-weight:100 900;font-display:block;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;}
  #stage{position:relative;width:${W}px;height:${H}px;font-family:'Brand',sans-serif;}
  #bg{position:absolute;inset:0;background-image:url('${bgUri}');background-size:cover;background-position:${side} center;}
  #text{position:absolute;top:0;${side}:0;height:${H}px;width:66%;display:flex;flex-direction:column;
    justify-content:center;align-items:${isRTL ? 'flex-end' : 'flex-start'};text-align:${isRTL ? 'right' : 'left'};
    padding:56px 60px;direction:${isRTL ? 'rtl' : 'ltr'};}
  /* No scrim/overlay/vignette. A subtle GLYPH-level shadow (not a box/gradient) keeps
     white text legible while the composition itself provides the negative space. */
  .line{font-weight:800;line-height:1.1;color:#fff;white-space:nowrap;font-size:74px;
    text-shadow:0 1px 2px rgba(0,0,0,0.28), 0 2px 16px rgba(0,0,0,0.22);}
  .line.emph{color:${EMPHASIS};}
</style></head><body><div id="stage">
  <div id="bg"></div>
  <div id="text">${linesHtml}</div>
</div></body></html>`;
}

// In-page auto-fit (passed as a STRING so Node's TS lib doesn't need DOM types):
// waits for the embedded font, then shrinks the headline until the widest line fits
// the text column using REAL browser metrics — so the phrase-aware breaks are honored
// and nothing soft-wraps into orphan lines.
// In-page (a) auto-fit + (b) LUMINANCE-AWARE adaptive typography. After the background
// is rendered, we redraw it into a canvas with the SAME cover/position mapping as #bg,
// measure the average luminance UNDER the headline, and pick text color accordingly:
//   bright background → near-black/charcoal text   |   dark/mid → white text.
// This is adaptive typography, NOT image darkening — no scrim/gradient/vignette is added.
function adaptiveScript(W: number, H: number, side: 'left' | 'right', bgUri: string): string {
  return `(async () => {
  await document.fonts.ready;
  var text = document.getElementById('text');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.line'));
  if (!text || !lines.length) return;
  // (a) auto-fit headline to the column using real metrics
  var cs = getComputedStyle(text);
  var avail = text.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var size = 74;
  var fits = function(){ return lines.every(function(l){ return l.scrollWidth <= avail; }); };
  while (size > 30 && !fits()) { size -= 1; lines.forEach(function(l){ l.style.fontSize = size + 'px'; }); }
  // (b) luminance-aware color — sample the background under the actual headline lines
  try {
    var img = new Image(); img.src = ${JSON.stringify(bgUri)}; await img.decode();
    var c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    var ctx = c.getContext('2d');
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var scale = Math.max(${W}/nw, ${H}/nh), sw = nw*scale, sh = nh*scale;
    var dx = ${JSON.stringify(side)} === 'left' ? 0 : (${JSON.stringify(side)} === 'right' ? (${W}-sw) : (${W}-sw)/2);
    var dy = (${H}-sh)/2;
    ctx.drawImage(img, dx, dy, sw, sh);
    var rs = lines.map(function(l){ return l.getBoundingClientRect(); });
    var rx = Math.max(0, Math.floor(Math.min.apply(null, rs.map(function(r){return r.left;})) ) - 8);
    var ry = Math.max(0, Math.floor(Math.min.apply(null, rs.map(function(r){return r.top;})) ) - 6);
    var rr = Math.min(${W}, Math.ceil(Math.max.apply(null, rs.map(function(r){return r.right;})) ) + 8);
    var rb = Math.min(${H}, Math.ceil(Math.max.apply(null, rs.map(function(r){return r.bottom;})) ) + 6);
    var d = ctx.getImageData(rx, ry, Math.max(1, rr-rx), Math.max(1, rb-ry)).data;
    var sum = 0, n = 0;
    for (var i = 0; i < d.length; i += 16) { sum += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]; n++; }
    var avg = n ? sum/n : 0;
    var bright = avg > 150; // 0..255
    lines.forEach(function(l){
      var isAccent = l.classList.contains('emph');
      l.style.color = bright ? (isAccent ? '#094CB2' : '#10192B') : (isAccent ? '#4DA3FF' : '#FFFFFF');
      l.style.textShadow = bright
        ? '0 1px 2px rgba(255,255,255,0.55), 0 2px 12px rgba(255,255,255,0.45)'
        : '0 1px 2px rgba(0,0,0,0.30), 0 2px 16px rgba(0,0,0,0.22)';
    });
  } catch (e) { /* keep CSS default (white) on any sampling failure */ }
})()`;
}

export async function renderOverlay(
  backgroundBytes: Buffer,
  overlay: OverlaySpec,
  platform: string,
): Promise<{ png: Buffer; width: number; height: number }> {
  const [W, H] = PLATFORM_SIZES[platform] ?? PLATFORM_SIZES.linkedin;
  const isRTL = overlay.dir === 'rtl';
  const side: 'left' | 'right' = isRTL ? 'right' : 'left';
  const bgUri = `data:image/png;base64,${backgroundBytes.toString('base64')}`;
  const html = buildHtml(bgUri, overlay, W, H);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(adaptiveScript(W, H, side, bgUri));
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    return { png, width: W, height: H };
  } finally {
    await page.close();
  }
}
