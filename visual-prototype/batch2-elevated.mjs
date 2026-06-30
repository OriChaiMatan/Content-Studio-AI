// Batch 2 — ELEVATED cinematic prompting. Goal: Apple/Nvidia keynote x Hollywood
// sci-fi poster intensity. Emotion + scale + impossible perspective + volumetric
// fog + particles + bloom + extreme contrast. NO literal shield/server/blue-glow.
// Same hybrid pipeline (background only from AI; LumAI renders all text). 6 cats x 2.
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

// Cinematic craft suffix — drama over literal objects.
const SUFFIX = ' Cinematic masterpiece, the scale of an Apple or Nvidia keynote hero shot crossed with a Hollywood science-fiction film poster. Impossible monumental scale, dramatic depth, an awe-inspiring vanishing point, volumetric god-rays, thick atmospheric fog, drifting luminous particles, lens bloom, extreme chiaroscuro contrast, premium cinematic color grade in deep blues and cyan with subtle warm rim-light accents. Heroic, breathtaking, makes you stop scrolling. Leave clean, calm NEGATIVE SPACE on the LEFT third for a text overlay. Absolutely NO text, no words, no letters, no numbers, no logos, no UI screens, no watermarks, no people, no brands, no charts. Not a flat illustration, not safe corporate SaaS art, not a stock photo, not a generic cyber motif, not cartoonish.';

const CATS = [
  { key: 'ai_infrastructure', lines: ['The real AI war', 'is happening at', 'inference'], emph: 2,
    scene: 'A colossal monolith of pure light and circuitry suspended in an infinite dark void, energy cascading along its impossible surfaces, a single luminous horizon far below.' },
  { key: 'cybersecurity', lines: ['Your defense begins', 'before the', 'attack'], emph: 2,
    scene: 'A vast cathedral of dark geometric monoliths under a charged electric storm, a single piercing beam of light splitting the darkness, arcs of energy and embers in heavy fog.' },
  { key: 'business_strategy', lines: ['Strategy is what', 'you choose', 'not to do'], emph: 2,
    scene: 'An immense abstract landscape of towering geometric forms with one luminous path carving toward an impossibly distant glowing horizon at dawn, epic and silent.' },
  { key: 'leadership', lines: ['Leadership is', 'a function of', 'clarity'], emph: 2,
    scene: 'A lone radiant summit rising above an endless ocean of storm clouds, a single shaft of sun breaking through, god-rays and vast atmospheric depth, aspirational grandeur.' },
  { key: 'healthcare', lines: ['Care is shifting', 'from reactive', 'to predictive'], emph: 2,
    scene: 'A luminous cosmos of glowing organic filaments and cellular constellations stretching into deep space, ethereal bloom and drifting particles, breathtaking scale.' },
  { key: 'finance', lines: ['Capital follows', 'conviction,', 'not consensus'], emph: 1,
    scene: 'A monumental dark cathedral of geometric architecture with rivers of molten luminous energy flowing through it into the distance, volumetric haze, embers, immense depth.' },
];

const MARK = (size) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${EMPHASIS}"/></svg>`;
  return { type: 'img', props: { width: size, height: size, src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` } };
};

async function genBg(prompt, outPath) {
  if (fs.existsSync(outPath)) return;
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high', n: 1 }) });
      const json = await res.json();
      if (!res.ok) { if (res.status === 429 && a < 3) { await new Promise(r => setTimeout(r, 8000 * a)); continue; } throw new Error(`${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 160)}`); }
      fs.writeFileSync(outPath, Buffer.from(json.data[0].b64_json, 'base64')); return;
    } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 4000 * a)); }
  }
}

function composeFinal(cat, bgPath) {
  const bgB64 = fs.readFileSync(bgPath).toString('base64');
  const scrim = 'linear-gradient(90deg, rgba(3,7,16,0.92) 0%, rgba(3,7,16,0.55) 34%, rgba(3,7,16,0) 64%)';
  return { type: 'div', props: { style: { display: 'flex', width: `${W}px`, height: `${H}px`, position: 'relative', fontFamily: 'Arial' }, children: [
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: `url(data:image/png;base64,${bgB64})`, backgroundSize: 'cover', backgroundPosition: 'left center' } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: scrim } } },
    { type: 'div', props: { style: { position: 'absolute', top: 0, left: '0px', height: `${H}px`, width: '66%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '56px 60px' }, children: [
      { type: 'div', props: { style: { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: EMPHASIS, marginBottom: '20px' }, children: cat.key.replace(/_/g, ' ').toUpperCase() } },
      ...cat.lines.map((line, i) => ({ type: 'div', props: { style: { fontSize: 66, fontWeight: 700, lineHeight: 1.04, color: i === cat.emph ? EMPHASIS : '#FFFFFF' }, children: line } })) ] } },
    { type: 'div', props: { style: { position: 'absolute', bottom: '40px', left: '60px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }, children: [MARK(34), { type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#FFFFFF' }, children: 'LumAI' } }] } },
  ] } };
}

async function toPng(node, w, h) {
  const svg = await satori(node, { width: w, height: h, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
}

async function sheet(cat) {
  const tw = 600, th = Math.round(tw * H / W), gap = 18, pad = 24, titleH = 52;
  const cells = [1, 2].map(i => ({ type: 'div', props: { style: { position: 'relative', width: `${tw}px`, height: `${th}px`, display: 'flex', backgroundImage: `url(data:image/png;base64,${fs.readFileSync(path.join(DIR, `e_${cat.key}_${i}.png`)).toString('base64')})`, backgroundSize: 'cover' },
    children: [{ type: 'div', props: { style: { position: 'absolute', top: '8px', left: '8px', display: 'flex', fontSize: 18, fontWeight: 700, color: '#FFF', backgroundColor: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: '6px' }, children: `#${i}` } }] } }));
  const sw = pad * 2 + tw * 2 + gap, sh = pad * 2 + titleH + th;
  const node = { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', width: `${sw}px`, height: `${sh}px`, backgroundColor: '#0B1220', padding: `${pad}px`, fontFamily: 'Arial' }, children: [
    { type: 'div', props: { style: { display: 'flex', fontSize: 26, fontWeight: 700, color: '#FFF', height: `${titleH}px`, alignItems: 'center' }, children: 'ELEVATED · ' + cat.key.replace(/_/g, ' ').toUpperCase() } },
    { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: `${gap}px` }, children: cells } } ] } };
  fs.writeFileSync(path.join(DIR, `sheet2_${cat.key}.png`), await toPng(node, sw, sh));
}

async function pool(items, n, fn) { const q = items.map(x => x); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }

(async () => {
  const tasks = CATS.flatMap(cat => [1, 2].map(i => ({ cat, i })));
  let done = 0;
  await pool(tasks, 4, async ({ cat, i }) => {
    const bg = path.join(DIR, `bg2_${cat.key}_${i}.png`);
    await genBg(cat.scene + SUFFIX, bg);
    fs.writeFileSync(path.join(DIR, `e_${cat.key}_${i}.png`), await toPng(composeFinal(cat, bg), W, H));
    console.log(`[${++done}/12] ${cat.key} #${i}`);
  });
  for (const cat of CATS) await sheet(cat);
  fs.writeFileSync(path.join(DIR, 'BATCH2_DONE'), new Date().toISOString());
  console.log('BATCH2 COMPLETE');
})().catch(e => { console.error('BATCH2 FAILED:', e.message); fs.writeFileSync(path.join(DIR, 'BATCH2_ERROR'), e.message); process.exit(1); });
