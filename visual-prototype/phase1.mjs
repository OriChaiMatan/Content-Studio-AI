// Phase 1 dev script (prototype, no production wiring).
// Pipeline: sample structured output -> visual intent (Claude) -> cinematic prompt
//           -> gpt-image-1 background -> LumAI overlay render -> final PNG.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractVisualIntent } from './visualIntentService.mjs';
import { buildBackgroundPrompt } from './visualPrompt.mjs';
import { renderFinal } from './overlayRender.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OPENAI_KEY = fs.readFileSync(path.resolve(DIR, '../backend/.env'), 'utf8').split('\n').find(l => l.startsWith('OPENAI_API_KEY=')).slice(15).trim().replace(/^["']|["']$/g, '');

// Representative structured outputs (whitelisted fields only — no CTA/hashtags/body).
const SAMPLES = [
  { id: 'p1_ai', lang: 'en', platforms: ['linkedin', 'facebook'],
    fields: { thesis: 'The real AI war is happening at inference.', reframe: 'As model quality converges, advantage shifts from training to inference economics and distribution.',
      hook: "Everyone's racing to train bigger models. The real fight is somewhere else.", keyInsight: 'Inference cost and latency now decide who wins at scale.', title: 'The real AI war is happening at inference', lang: 'en' },
    overlay: { kicker: 'AI INFRASTRUCTURE', lines: ['The real AI war', 'is happening at', 'inference'], emphasisLine: 2, dir: 'ltr' } },
  { id: 'p2_cyber_he', lang: 'he', platforms: ['linkedin'],
    fields: { thesis: 'אבטחה מסורתית כבר לא יכולה להגן על הארגון המודרני.', reframe: 'בעידן מתקפות מבוססות בינה מלאכותית, היתרון עובר מזיהוי לתגובה אוטונומית בזמן אמת.',
      hook: 'חומות האש שבנינו לא נבנו לעולם הזה.', keyInsight: 'מתקפות מבוססות AI מתפתחות מהר מהיכולת האנושית להגיב.', title: 'ההגנה האמיתית מתחילה לפני המתקפה', lang: 'he' },
    overlay: { kicker: 'אבטחת סייבר', lines: ['ההגנה האמיתית', 'מתחילה לפני', 'המתקפה'], emphasisLine: 2, dir: 'rtl' } },
  { id: 'p3_leadership', lang: 'en', platforms: ['facebook'],
    fields: { thesis: 'Leadership is a function of clarity, not authority.', reframe: 'Aligned teams moving on a clear thesis outperform controlled ones.',
      hook: "The best leaders remove fog. They don't add pressure.", keyInsight: 'Clarity compounds across a team faster than control does.', title: 'Leadership is a function of clarity', lang: 'en' },
    overlay: { kicker: 'LEADERSHIP', lines: ['Leadership is', 'a function of', 'clarity'], emphasisLine: 2, dir: 'ltr' } },
];

async function genBg(prompt, outPath) {
  if (fs.existsSync(outPath)) return;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high', n: 1 }), signal: AbortSignal.timeout(180000) });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 160)}`);
  fs.writeFileSync(outPath, Buffer.from(json.data[0].b64_json, 'base64'));
}

const report = [];
for (const s of SAMPLES) {
  const { intent, source } = await extractVisualIntent(s.fields);
  const prompt = buildBackgroundPrompt(intent);
  report.push({ id: s.id, lang: s.lang, intentSource: source, visualIntent: intent });
  console.log(`\n[${s.id}] intent(${source}): ${intent}`);
  const bg = path.join(DIR, `p1_bg_${s.id}.png`);
  await genBg(prompt, bg);
  for (const platform of s.platforms) {
    const png = await renderFinal({ bgPath: bg, overlay: s.overlay, platform });
    const file = `p1_${s.id}_${platform}.png`;
    fs.writeFileSync(path.join(DIR, file), png);
    console.log(`  -> ${file}`);
  }
}
fs.writeFileSync(path.join(DIR, 'p1_intent_report.json'), JSON.stringify(report, null, 2));
console.log('\nPHASE1 COMPLETE');
