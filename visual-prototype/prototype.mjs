// LumAI Hybrid Visual Engine — QUALITY PROTOTYPE (not production).
// Pipeline: sample output -> deterministic visual brief -> REAL gpt-image-1 background
//           -> Satori/resvg overlay (headline + subtitle + LumAI lockup) -> platform PNG.
// Real OpenAI, high quality, hybrid (bg only from AI), EN + HE/RTL. No extra LLM call.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ENV = fs.readFileSync(path.resolve(DIR, '../backend/.env'), 'utf8');
const KEY = ENV.split('\n').find(l => l.startsWith('OPENAI_API_KEY=')).slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');

const FONT_BOLD = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const FONT_REG = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Unicode.ttf');
const FONTS = [
  { name: 'Arial', data: FONT_BOLD, weight: 700, style: 'normal' },
  { name: 'Arial', data: FONT_REG, weight: 400, style: 'normal' },
];

const BRAND = '#094CB2';        // LumAI brand blue (reference)
const EMPHASIS = '#4DA3FF';     // brightened brand blue — readable on dark cinematic bg
const PLATFORMS = { linkedin: [1200, 627], facebook: [1200, 630] };

// ── Sample outputs (representative LumAI content; headline taken from existing
//    hook/thesis fields only — NO extra LLM call) ────────────────────────────
const SAMPLES = {
  en: {
    lang: 'en', dir: 'ltr', category: 'ai_infrastructure',
    kicker: 'AI INFRASTRUCTURE',
    headlineLines: ['The real AI war', 'is happening at', 'inference'],
    emphasisLine: 2,
    subtitle: 'Why durable advantage is moving to the serving layer',
    bgFile: 'bg_ai.png',
    bgPrompt:
      'Cinematic, premium B2B technology background. A vast futuristic AI data center seen with dramatic depth, ' +
      'deep navy and electric blue glow, volumetric god-rays, glowing server racks receding into atmospheric haze, ' +
      'fine particle light, high-end enterprise SaaS aesthetic, photorealistic, expensive and sophisticated. ' +
      'Leave clean, calm NEGATIVE SPACE on the LEFT third for text. ' +
      'Absolutely NO text, no words, no letters, no numbers, no logos, no UI screens, no watermarks, no people, no brands. ' +
      'Not generic stock photography, not cartoonish, not cheap 3D clipart.',
  },
  he: {
    lang: 'he', dir: 'rtl', category: 'cybersecurity',
    kicker: 'אבטחת סייבר',
    headlineLines: ['ההגנה האמיתית', 'מתחילה לפני', 'המתקפה'],
    emphasisLine: 2,
    subtitle: 'אבטחת סייבר לארגון המודרני',
    bgFile: 'bg_cyber.png',
    bgPrompt:
      'Cinematic, premium B2B cybersecurity background. An abstract digital fortress of glowing blue shield-like light ' +
      'structures, deep navy, encrypted data streams as luminous trails, dramatic depth, volumetric glow, ' +
      'high-end enterprise SaaS aesthetic, photorealistic, expensive and sophisticated. ' +
      'Leave clean, calm NEGATIVE SPACE on the RIGHT third for text. ' +
      'Absolutely NO text, no words, no letters, no numbers, no logos, no UI screens, no watermarks, no people, no brands. ' +
      'Not generic stock photography, not cartoonish, not cheap 3D clipart.',
  },
};

// LumAI mark (white L + blue star) as a data-URI <img>.
const MARK = (size) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 36V104H92" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z" fill="${EMPHASIS}"/></svg>`;
  return { type: 'img', props: { width: size, height: size, src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` } };
};

async function generateBackground(s) {
  const out = path.join(DIR, s.bgFile);
  if (fs.existsSync(out)) { console.log(`[bg] reuse ${s.bgFile}`); return; }
  console.log(`[bg] generating ${s.bgFile} (gpt-image-1, high, 1536x1024)…`);
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: s.bgPrompt, size: '1536x1024', quality: 'high', n: 1 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  fs.writeFileSync(out, Buffer.from(json.data[0].b64_json, 'base64'));
  console.log(`[bg] ${s.bgFile} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function compose(s, platform, [W, H]) {
  const bgB64 = fs.readFileSync(path.join(DIR, s.bgFile)).toString('base64');
  const isRTL = s.dir === 'rtl';
  const side = isRTL ? 'right' : 'left';
  const scrim = isRTL
    ? 'linear-gradient(270deg, rgba(3,7,16,0.94) 0%, rgba(3,7,16,0.6) 34%, rgba(3,7,16,0) 64%)'
    : 'linear-gradient(90deg, rgba(3,7,16,0.94) 0%, rgba(3,7,16,0.6) 34%, rgba(3,7,16,0) 64%)';

  const headline = s.headlineLines.map((line, i) => ({
    type: 'div',
    props: { style: { fontSize: 64, fontWeight: 700, lineHeight: 1.04, color: i === s.emphasisLine ? EMPHASIS : '#FFFFFF', direction: s.dir }, children: line },
  }));

  return {
    type: 'div',
    props: {
      style: { display: 'flex', width: `${W}px`, height: `${H}px`, position: 'relative', fontFamily: 'Arial' },
      children: [
        // 1. AI background (cover-cropped, keep the negative-space side visible)
        { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`,
            backgroundImage: `url(data:image/png;base64,${bgB64})`, backgroundSize: 'cover', backgroundPosition: `${side} center` } } },
        // 2. localized scrim only behind the text zone
        { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: `${W}px`, height: `${H}px`, backgroundImage: scrim } } },
        // 3-4. text block (kicker + headline + subtitle)
        { type: 'div', props: { style: {
            position: 'absolute', top: 0, [side]: '0px', height: `${H}px`, width: '66%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: isRTL ? 'flex-end' : 'flex-start', textAlign: isRTL ? 'right' : 'left',
            padding: '56px 60px', direction: s.dir },
          children: [
            { type: 'div', props: { style: { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: EMPHASIS, marginBottom: '18px', direction: s.dir }, children: s.kicker } },
            ...headline,
            { type: 'div', props: { style: { display: 'flex', fontSize: 24, fontWeight: 400, color: '#C9D8EE', marginTop: '22px', maxWidth: '560px', direction: s.dir }, children: s.subtitle } },
          ] } },
        // 5. LumAI brand lockup, bottom on the text side
        { type: 'div', props: { style: {
            position: 'absolute', bottom: '40px', [side]: '60px',
            display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '12px' },
          children: [ MARK(34), { type: 'div', props: { style: { fontSize: 28, fontWeight: 700, color: '#FFFFFF' }, children: 'LumAI' } } ] } },
      ],
    },
  };
}

async function render(s, platform) {
  const [W, H] = PLATFORMS[platform];
  const svg = await satori(compose(s, platform, [W, H]), { width: W, height: H, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  const file = `${s.lang}_${platform}.png`;
  fs.writeFileSync(path.join(DIR, file), png);
  console.log(`[render] ${file} (${W}x${H})`);
}

(async () => {
  for (const s of Object.values(SAMPLES)) await generateBackground(s);
  for (const s of Object.values(SAMPLES)) for (const p of Object.keys(PLATFORMS)) await render(s, p);
  console.log('done');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
