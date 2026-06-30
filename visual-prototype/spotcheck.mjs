// Intent-driven consistency spot-check (Phase 1 pipeline, guardrails updated).
// 6 varied real-ish post concepts (one per category) -> intent -> cinematic prompt
// -> gpt-image-1 background -> LumAI overlay -> final PNG. Then a contact sheet.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractVisualIntent } from './visualIntentService.mjs';
import { buildBackgroundPrompt } from './visualPrompt.mjs';
import { renderFinal } from './overlayRender.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OPENAI_KEY = fs.readFileSync(path.resolve(DIR, '../backend/.env'), 'utf8').split('\n').find(l => l.startsWith('OPENAI_API_KEY=')).slice(15).trim().replace(/^["']|["']$/g, '');
const FONT = [{ name: 'Arial', data: fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf'), weight: 700, style: 'normal' }];

const SAMPLES = [
  { id: 'ai', platform: 'linkedin', overlay: { kicker: 'AI INFRASTRUCTURE', lines: ['Compute is the', 'new', 'oil'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'Compute capacity is the new oil of the AI economy.', reframe: 'Whoever controls GPUs and power controls the pace of AI.', hook: 'Models are commoditizing. Compute is not.', keyInsight: 'Energy and silicon scarcity now gate AI progress, not ideas.', title: 'Compute is the new oil', lang: 'en' } },
  { id: 'cyber', platform: 'linkedin', overlay: { kicker: 'CYBERSECURITY', lines: ['The breach', 'already', 'happened'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'Assume the breach already happened; defense is about containment now.', reframe: 'Prevention is dead; resilience and rapid response win.', hook: 'You are not trying to keep them out anymore.', keyInsight: 'Attackers are already inside; speed of detection is the real moat.', title: 'The breach already happened', lang: 'en' } },
  { id: 'leadership', platform: 'linkedin', overlay: { kicker: 'LEADERSHIP', lines: ['Silence is', 'a', 'decision'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'A leader’s silence is itself a decision with consequences.', reframe: 'Not speaking sets direction as loudly as speaking.', hook: 'Your team is reading the things you do not say.', keyInsight: 'Ambiguity from the top compounds into misalignment below.', title: 'Silence is a decision', lang: 'en' } },
  { id: 'healthcare', platform: 'linkedin', overlay: { kicker: 'HEALTHCARE INNOVATION', lines: ['Medicine is', 'becoming', 'predictive'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'Medicine is shifting from treating illness to predicting and preventing it.', reframe: 'The hospital of the future intervenes before symptoms appear.', hook: 'The biggest breakthroughs happen before you ever feel sick.', keyInsight: 'Continuous data turns care from reactive to anticipatory.', title: 'Medicine is becoming predictive', lang: 'en' } },
  { id: 'finance', platform: 'linkedin', overlay: { kicker: 'FINANCIAL INTELLIGENCE', lines: ['Liquidity', 'hides the', 'risk'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'Abundant liquidity masks the real risk building underneath markets.', reframe: 'Calm markets are where the next crisis quietly accumulates.', hook: 'The danger is loudest when everything feels calm.', keyInsight: 'Cheap capital hides fragility until liquidity suddenly withdraws.', title: 'Liquidity hides the risk', lang: 'en' } },
  { id: 'strategy', platform: 'linkedin', overlay: { kicker: 'BUSINESS STRATEGY', lines: ['Moats are', 'built in', 'downturns'], emphasisLine: 2, dir: 'ltr' },
    fields: { thesis: 'Durable competitive moats are built during downturns, not booms.', reframe: 'Recessions are when winners quietly pull away.', hook: 'The next decade’s leaders are deciding their fate right now.', keyInsight: 'Discipline under pressure compounds into structural advantage.', title: 'Moats are built in downturns', lang: 'en' } },
];

async function genBg(prompt, outPath) {
  if (fs.existsSync(outPath)) return;
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high', n: 1 }), signal: AbortSignal.timeout(180000) });
      const json = await res.json();
      if (!res.ok) { if (res.status === 429 && a < 3) { await new Promise(r => setTimeout(r, 8000 * a)); continue; } throw new Error(`${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 160)}`); }
      fs.writeFileSync(outPath, Buffer.from(json.data[0].b64_json, 'base64')); return;
    } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 4000 * a)); }
  }
}

async function pool(items, n, fn) { const q = items.map(x => x); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }

const report = [];
await pool(SAMPLES, 3, async (s) => {
  const { intent, source } = await extractVisualIntent(s.fields);
  const bg = path.join(DIR, `sc2_bg_${s.id}.png`);
  await genBg(buildBackgroundPrompt(intent), bg);
  fs.writeFileSync(path.join(DIR, `sc2_${s.id}.png`), await renderFinal({ bgPath: bg, overlay: s.overlay, platform: s.platform }));
  report.push({ id: s.id, intentSource: source, visualIntent: intent });
  console.log(`[${s.id}] (${source}) ${intent}`);
});

// Contact sheet: 6 finals in a 3x2 grid for scoring.
const tw = 560, th = Math.round(tw * 627 / 1200), gap = 16, pad = 24, titleH = 0;
const order = ['ai', 'cyber', 'leadership', 'healthcare', 'finance', 'strategy'];
const cell = (id) => ({ type: 'div', props: { style: { position: 'relative', width: `${tw}px`, height: `${th}px`, display: 'flex', backgroundImage: `url(data:image/png;base64,${fs.readFileSync(path.join(DIR, `sc2_${id}.png`)).toString('base64')})`, backgroundSize: 'cover' },
  children: [{ type: 'div', props: { style: { position: 'absolute', top: '6px', left: '6px', display: 'flex', fontSize: 16, fontWeight: 700, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '5px' }, children: id } }] } });
const row = (ids) => ({ type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: `${gap}px` }, children: ids.map(cell) } });
const sw = pad * 2 + tw * 3 + gap * 2, sh = pad * 2 + th * 2 + gap;
const sheet = { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: `${gap}px`, width: `${sw}px`, height: `${sh}px`, backgroundColor: '#0B1220', padding: `${pad}px`, fontFamily: 'Arial' }, children: [row(order.slice(0, 3)), row(order.slice(3))] } };
const svg = await satori(sheet, { width: sw, height: sh, fonts: FONT });
fs.writeFileSync(path.join(DIR, 'sc2_sheet.png'), new Resvg(svg, { fitTo: { mode: 'width', value: sw } }).render().asPng());
fs.writeFileSync(path.join(DIR, 'sc2_report.json'), JSON.stringify(report, null, 2));
console.log('SPOTCHECK COMPLETE');
