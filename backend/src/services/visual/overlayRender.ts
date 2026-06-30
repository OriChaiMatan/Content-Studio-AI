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

// Localized side-scrim — guarantees text contrast over ANY palette; opposite side stays vivid.
function scrimCss(side: 'left' | 'right'): string {
  const stops = 'rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 24%, rgba(0,0,0,0.45) 46%, rgba(0,0,0,0) 64%';
  return `linear-gradient(${side === 'right' ? '270deg' : '90deg'}, ${stops})`;
}

function buildHtml(bgUri: string, overlay: OverlaySpec, W: number, H: number): string {
  const isRTL = overlay.dir === 'rtl';
  const side: 'left' | 'right' = isRTL ? 'right' : 'left';
  const lang = isRTL ? 'he' : 'en';
  const linesHtml = overlay.lines
    .map((l, i) => `<div class="line${i === overlay.emphasisLine ? ' emph' : ''}">${esc(l)}</div>`)
    .join('');
  return `<!doctype html><html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  @font-face{font-family:'Brand';src:url('${heeboDataUri()}') format('truetype');font-weight:100 900;font-display:block;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;}
  #stage{position:relative;width:${W}px;height:${H}px;font-family:'Brand',sans-serif;}
  #bg{position:absolute;inset:0;background-image:url('${bgUri}');background-size:cover;background-position:${side} center;}
  #scrim{position:absolute;inset:0;background-image:${scrimCss(side)};}
  #text{position:absolute;top:0;${side}:0;height:${H}px;width:66%;display:flex;flex-direction:column;
    justify-content:center;align-items:${isRTL ? 'flex-end' : 'flex-start'};text-align:${isRTL ? 'right' : 'left'};
    padding:56px 60px;direction:${isRTL ? 'rtl' : 'ltr'};}
  #kicker{font-size:20px;font-weight:700;letter-spacing:4px;color:${EMPHASIS};margin-bottom:20px;white-space:nowrap;}
  .line{font-weight:800;line-height:1.1;color:#fff;white-space:nowrap;font-size:66px;}
  .line.emph{color:${EMPHASIS};}
</style></head><body><div id="stage">
  <div id="bg"></div><div id="scrim"></div>
  <div id="text"><div id="kicker">${esc(overlay.kicker)}</div>${linesHtml}</div>
</div></body></html>`;
}

// In-page auto-fit (passed as a STRING so Node's TS lib doesn't need DOM types):
// waits for the embedded font, then shrinks the headline until the widest line fits
// the text column using REAL browser metrics — so the phrase-aware breaks are honored
// and nothing soft-wraps into orphan lines.
const FIT_SCRIPT = `(async () => {
  await document.fonts.ready;
  var text = document.getElementById('text');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.line'));
  if (!text || !lines.length) return;
  var cs = getComputedStyle(text);
  var avail = text.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var size = 66;
  var fits = function(){ return lines.every(function(l){ return l.scrollWidth <= avail; }); };
  while (size > 30 && !fits()) { size -= 1; lines.forEach(function(l){ l.style.fontSize = size + 'px'; }); }
})()`;

export async function renderOverlay(
  backgroundBytes: Buffer,
  overlay: OverlaySpec,
  platform: string,
): Promise<{ png: Buffer; width: number; height: number }> {
  const [W, H] = PLATFORM_SIZES[platform] ?? PLATFORM_SIZES.linkedin;
  const bgUri = `data:image/png;base64,${backgroundBytes.toString('base64')}`;
  const html = buildHtml(bgUri, overlay, W, H);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(FIT_SCRIPT);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    return { png, width: W, height: H };
  } finally {
    await page.close();
  }
}
