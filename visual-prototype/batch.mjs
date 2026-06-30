// Consistency batch: 6 categories x 3 generations = 18 real gpt-image-1 backgrounds,
// same hybrid pipeline, HEADLINE ONLY (no subtitle), English LinkedIn 1200x627.
// Produces per-generation finals + 6 per-category contact sheets for scoring.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KEY = fs.readFileSync(path.resolve(DIR, '../backend/.env'), 'utf8')
  .split('\n').find(l => l.startsWith('OPENAI_API_KEY=')).slice(15).trim().replace(/^["']|["']$/g, '');
const FONT_BOLD = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const FONTS = [{ name: 'Arial', data: FONT_BOLD, weight: 700, style: 'normal' }];
const EMPHASIS = '#4DA3FF';
const [W, H] = [1200, 627];

const SUFFIX = ' Deep navy and electric blue, dramatic depth, premium volumetric lighting, high-end enterprise SaaS aesthetic, photorealistic, expensive and sophisticated. Leave clean, calm NEGATIVE SPACE on the LEFT third for text. Absolutely NO text, no words, no letters, no numbers, no logos, no UI screens, no watermarks, no people, no brands, no charts. Not generic stock photography, not cartoonish, not cheap 3D clipart.';

const CATS = [
  { key: 'ai_infrastructure', lines: ['The real AI war', 'is happening at', 'inference'], emph: 2,
    scene: 'Cinematic premium B2B background: a vast futuristic AI data center with glowing server racks receding into atmospheric haze, volumetric god-rays.' },
  { key: 'cybersecurity', lines: ['Your defense begins', 'before the', 'attack'], emph: 2,
    scene: 'Cinematic premium B2B cybersecurity background: an abstract digital fortress of glowing shield-like light structures and encrypted data streams as luminous trails.' },
  { key: 'business_strategy', lines: ['Strategy is what', 'you choose', 'not to do'], emph: 2,
    scene: 'Cinematic premium B2B business-strategy background: abstract intersecting luminous pathways and converging geometric light routes suggesting decisions and direction.' },
  { key: 'leadership', lines: ['Leadership is', 'a function of', 'clarity'], emph: 2,
    scene: 'Cinematic premium B2B leadership background: a single dramatic beam of light cutting through vast architectural darkness toward an open horizon, aspirational and minimal.' },
  { key: 'healthcare', lines: ['Care is shifting', 'from reactive', 'to predictive'], emph: 2,
    scene: 'Cinematic premium B2B healthcare-innovation background: abstract glowing molecular and DNA helix light structures, clean clinical blue, advanced biotech.' },
  { key: 'finance', lines: ['Capital follows', 'conviction,', 'not consensus'], emph: 1,
    scene: 'Cinematic premium B2B financial-intelligence background: abstract luminous data flows and a glowing network of market nodes and light streams, advanced fintech.' },
];

const MARK = (size) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${EMPHASIS}"/></svg>`;
  return { type: 'img', props: { width: size, height: size, src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` } };
};

async function genBg(prompt, outPath) {
  if (fs.existsSync(outPath)) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high', n: 1 }),
      });
      const json = await res.json();
      if (!res.ok) { if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 8000 * attempt)); continue; } throw new Error(`${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 160)}`); }
      fs.writeFileSync(outPath, Buffer.from(json.data[0].b64_json, 'base64'));
      return;
    } catch (e) { if (attempt === 3) throw e; await new Promise(r => setTimeout(r, 4000 * attempt)); }
  }
}

function composeFinal(cat, bgPath) {
  const bgB64 = fs.readFileSync(bgPath).toString('base64');
  const scrim = 'linear-gradient(90deg, rgba(3,7,16,0.94) 0%, rgba(3,7,16,0.6) 34%, rgba(3,7,16,0) 64%)';
  return {
    type: 'div',
    props: { style: { display: 'flex', width: `${W}px`, height: `${H}px`, position: 'relative', fontFamily: 'Arial' }, children: [
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: `url(data:image/png;base64,${bgB64})`, backgroundSize: 'cover', backgroundPosition: 'left center' } } },
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: scrim } } },
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: '0px', height: `${H}px`, width: '66%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '56px 60px' },
        children: [
          { type: 'div', props: { style: { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: EMPHASIS, marginBottom: '20px' }, children: cat.key.replace(/_/g, ' ').toUpperCase() } },
          ...cat.lines.map((line, i) => ({ type: 'div', props: { style: { fontSize: 66, fontWeight: 700, lineHeight: 1.04, color: i === cat.emph ? EMPHASIS : '#FFFFFF' }, children: line } })),
        ] } },
      { type: 'div', props: { style: { position: 'absolute', bottom: '40px', left: '60px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' },
        children: [MARK(34), { type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#FFFFFF' }, children: 'LumAI' } }] } },
    ] },
  };
}

async function toPng(node, w, h) {
  const svg = await satori(node, { width: w, height: h, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
}

async function contactSheet(cat) {
  const tw = 600, th = Math.round(tw * H / W), gap = 18, pad = 24, titleH = 52;
  const cells = [1, 2, 3].map(i => ({
    type: 'div', props: { style: { position: 'relative', width: `${tw}px`, height: `${th}px`, display: 'flex',
        backgroundImage: `url(data:image/png;base64,${fs.readFileSync(path.join(DIR, `b_${cat.key}_${i}.png`)).toString('base64')})`, backgroundSize: 'cover' },
      children: [{ type: 'div', props: { style: { position: 'absolute', top: '8px', left: '8px', display: 'flex', fontSize: 18, fontWeight: 700, color: '#FFF', backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: '6px' }, children: `#${i}` } }] } }));
  const sheetW = pad * 2 + tw * 3 + gap * 2, sheetH = pad * 2 + titleH + th;
  const node = { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', width: `${sheetW}px`, height: `${sheetH}px`, backgroundColor: '#0B1220', padding: `${pad}px`, fontFamily: 'Arial' },
    children: [
      { type: 'div', props: { style: { display: 'flex', fontSize: 26, fontWeight: 700, color: '#FFF', height: `${titleH}px`, alignItems: 'center' }, children: cat.key.replace(/_/g, ' ').toUpperCase() } },
      { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: `${gap}px` }, children: cells } },
    ] } };
  fs.writeFileSync(path.join(DIR, `sheet_${cat.key}.png`), await toPng(node, sheetW, sheetH));
}

async function pool(items, n, fn) {
  const q = items.map((it, i) => [it, i]);
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const [it] = q.shift(); await fn(it); } }));
}

(async () => {
  const tasks = CATS.flatMap(cat => [1, 2, 3].map(i => ({ cat, i })));
  let done = 0;
  await pool(tasks, 4, async ({ cat, i }) => {
    const bg = path.join(DIR, `bg_${cat.key}_${i}.png`);
    await genBg(cat.scene + SUFFIX, bg);
    fs.writeFileSync(path.join(DIR, `b_${cat.key}_${i}.png`), await toPng(composeFinal(cat, bg), W, H));
    console.log(`[${++done}/18] ${cat.key} #${i}`);
  });
  for (const cat of CATS) await contactSheet(cat);
  fs.writeFileSync(path.join(DIR, 'BATCH_DONE'), new Date().toISOString());
  console.log('BATCH COMPLETE');
})().catch(e => { console.error('BATCH FAILED:', e.message); fs.writeFileSync(path.join(DIR, 'BATCH_ERROR'), e.message); process.exit(1); });
