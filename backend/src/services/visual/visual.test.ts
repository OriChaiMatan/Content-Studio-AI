import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCase, ContentOutput } from '@prisma/client';
import { buildVisualBrief, isRtlText, wrapHeadline, overlayFromHeadline } from './visualBrief';
import { classifyArchetype, classifyLighting, humansAllowed, analyzeVisual, ARCHETYPES } from './visualIntelligence';
import { buildBackgroundPrompt } from './visualPrompt';
import { effectiveProvider, imageGenConfig } from '../../lib/visualConfig';

function fakeOutput(p: Partial<ContentOutput>): ContentOutput {
  return { id: 'o1', contentCaseId: 'c1', platform: 'linkedin', title: 'The real AI war is happening at inference',
    body: '...', status: 'draft', breakdown: { hook: 'The real AI war is happening at inference', insight: 'Inference economics decide the winners' },
    metadata: null, ...p } as unknown as ContentOutput;
}
function fakeCase(p: Partial<ContentCase>): ContentCase {
  return { id: 'c1', title: 'AI infra', contentGoal: 'thought_leadership', language: 'en', ...p } as unknown as ContentCase;
}

test('A. brief: headline lines come from the hook; LTR for English; WHITE by default (no accent)', () => {
  const b = buildVisualBrief(fakeOutput({}), fakeCase({}));
  assert.equal(b.language, 'en');
  assert.equal(b.overlay.dir, 'ltr');
  assert.ok(b.overlay.lines.length >= 1 && b.overlay.lines.length <= 3);
  assert.equal(b.visualCategory, 'ai_infrastructure');
  assert.equal(b.overlay.accentLine, null);   // default = all white
});

test('B. brief: Hebrew case → RTL', () => {
  const b = buildVisualBrief(fakeOutput({ breakdown: { hook: 'ההגנה האמיתית מתחילה לפני המתקפה' } as object, title: 'אבטחה' }), fakeCase({ language: 'he', title: 'אבטחת מידע' }));
  assert.equal(b.overlay.dir, 'rtl');
  assert.equal(b.overlay.accentLine, null);
});

test('B2. RTL is detected from TEXT even when the case is mislabeled language=en', () => {
  assert.equal(isRtlText('מי מייצר את השבבים'), true);
  assert.equal(isRtlText('The real AI war'), false);
  // Hebrew headline in an English-labeled case must still render RTL:
  const b = buildVisualBrief(
    fakeOutput({ breakdown: { hook: 'מי מייצר את השבבים, ומי באמת שולט בעתיד ה-AI?' } as object, title: 'AI' }),
    fakeCase({ language: 'en' }),
  );
  assert.equal(b.overlay.dir, 'rtl');
  assert.equal(b.language, 'he');
  assert.ok(b.overlay.lines.length >= 1 && b.overlay.lines.length <= 3);
  // Line splitting must keep words intact (no character mangling / reversal).
  assert.equal(b.overlay.lines.join(' ').replace(/\s+/g, ' ').trim(), 'מי מייצר את השבבים, ומי באמת שולט בעתיד ה-AI?');
});

test('B3. English headline stays LTR with words intact', () => {
  const b = buildVisualBrief(fakeOutput({ breakdown: { hook: 'The real AI war is happening at inference' } as object }), fakeCase({}));
  assert.equal(b.overlay.dir, 'ltr');
  assert.equal(b.overlay.lines.join(' '), 'The real AI war is happening at inference');
});

test('B4. wrapHeadline: Hebrew sample breaks at the comma into 2 clean lines (logical order preserved, no reversal)', () => {
  const src = 'מי מייצר את השבבים, ומי באמת שולט בעתיד ה-AI?';
  const lines = wrapHeadline(src, 3);
  assert.deepEqual(lines, ['מי מייצר את השבבים,', 'ומי באמת שולט בעתיד ה-AI?']);
  assert.equal(lines.join(' '), src);                 // logical order preserved
  assert.ok(lines.some(l => l.includes('ה-AI?')));     // mixed token intact
});

test('B5. wrapHeadline: English ≤3 lines, words intact (order preserved)', () => {
  const src = 'The real AI war is happening at inference';
  const lines = wrapHeadline(src, 3);
  assert.ok(lines.length >= 1 && lines.length <= 3);
  assert.equal(lines.join(' '), src);
});

test('B6. wrapHeadline NEVER truncates or adds an ellipsis (renderer is the size authority)', () => {
  const long = 'The real AI bottleneck is power and silicon and energy and cooling and capital';
  const lines = wrapHeadline(long, 3);
  assert.ok(lines.length <= 3);
  assert.equal(lines.join(' '), long);                 // every word kept
  assert.ok(!lines.some(l => l.includes('…')));        // no ellipsis
});

const CLICHE = /\b(soldiers?|battles?|fortress|castle|lighthouse|chess|robot face|neon cit|circuit[\s-]?board|glowing eyes|sci-?fi wallpaper|knight|sword)\b/i;

test('VI-1. thesis classification maps to the right archetype', () => {
  assert.equal(classifyArchetype('who controls the chips controls the future'), 'power_shift');
  assert.equal(classifyArchetype('the hidden infrastructure beneath the platform'), 'hidden_infrastructure');
  assert.equal(classifyArchetype('the bubble is fragile and will collapse'), 'collapse_fragility');
  assert.equal(classifyArchetype('the race to scale faster than rivals'), 'race_acceleration');
  assert.equal(classifyArchetype('medicine is becoming predictive'), 'transformation');
  assert.equal(classifyArchetype('cut through the noise to the real signal'), 'signal_vs_noise');
});

test('VI-2. analyzeVisual (offline fallback) → valid archetype, concrete cliché-free scene, palette, compressed headline', async () => {
  const plan = await analyzeVisual(
    { thesis: 'Compute capacity is the real bottleneck for AI', hook: 'Power and silicon are the ceiling', keyInsight: 'GPUs gate progress', title: 'Compute bottleneck', lang: 'en' },
    'ai_infrastructure',
  );
  assert.ok((ARCHETYPES as readonly string[]).includes(plan.archetype));
  assert.ok(plan.scene.length > 0 && !CLICHE.test(plan.scene), 'scene must be concrete and cliché-free');
  assert.ok(['warm', 'cool', 'neutral', 'high_contrast'].includes(plan.palette));
  assert.ok(plan.headline.split(/\s+/).length <= 14, 'headline ≤ 14 words');
});

test('VI-4. lighting defaults BRIGHT; dark only on explicit secrecy/fraud/collapse triggers', () => {
  // Bright by default — including breach/crisis framed around resilience.
  assert.equal(classifyLighting('compute is the real bottleneck for AI'), 'bright_editorial');
  assert.equal(classifyLighting('assume the breach happened; resilience beats prevention'), 'bright_editorial');
  assert.equal(classifyLighting('medicine is becoming predictive'), 'bright_editorial');
  // Dark only for genuine darkness triggers.
  assert.equal(classifyLighting('a massive accounting fraud and cover-up'), 'dark_dramatic');
  assert.equal(classifyLighting('the hidden risk building toward systemic collapse'), 'dark_dramatic');
});

test('VI-5. analyzeVisual (offline) defaults to bright_editorial lighting', async () => {
  const plan = await analyzeVisual({ thesis: 'Compute is the bottleneck for AI', hook: 'Power and silicon are the ceiling', title: 'Compute', lang: 'en' }, 'ai_infrastructure');
  assert.equal(plan.lighting, 'bright_editorial');
});

test('VI-6. prompt: bright by default forbids dark/night; dark_dramatic permits darker lighting', () => {
  const bright = buildBackgroundPrompt('a bright modern datacenter in daylight', 'hidden_infrastructure', 'bright_editorial');
  assert.ok(/BRIGHT, natural daylight/i.test(bright));
  assert.ok(/night scenes/i.test(bright) && /Avoid.*dark cinematic/is.test(bright));
  const dark = buildBackgroundPrompt('a concealed ledger room', 'collapse_fragility', 'dark_dramatic');
  assert.ok(/deliberately darker/i.test(dark));
});

test('VI-7. humans forbidden by default; allowed only for human-dynamics theses', () => {
  assert.equal(humansAllowed('ai_infrastructure', 'compute is the bottleneck'), false);
  assert.equal(humansAllowed('finance', 'hidden risk in private credit'), false);
  assert.equal(humansAllowed('leadership', 'silence is a decision'), true);            // leadership domain
  assert.equal(humansAllowed('business_strategy', 'great hiring beats great strategy'), true); // thesis trigger
  // Prompt enforces NO people unless allowed:
  const noPeople = buildBackgroundPrompt('a bright datacenter', 'power_shift', 'bright_editorial', false);
  assert.ok(/People: NONE/.test(noPeople) && /no people, humans, figures/i.test(noPeople));
  const withPeople = buildBackgroundPrompt('a bright boardroom', 'power_shift', 'bright_editorial', true);
  assert.ok(/ONLY if essential/i.test(withPeople));
});

test('VI-3. overlayFromHeadline: RTL/LTR + WHITE default, accent only on request', () => {
  const he = overlayFromHeadline('הברזל קובע: מי שמחזיק בשבב מחזיק בעתיד');
  assert.equal(he.dir, 'rtl');
  assert.equal(he.accentLine, null);                          // white by default
  const en = overlayFromHeadline('The real AI ceiling is power and silicon');
  assert.equal(en.dir, 'ltr');
  assert.equal(en.lines.join(' '), 'The real AI ceiling is power and silicon');
  assert.equal(en.accentLine, null);
  // accent=true tints the LAST line only when there are ≥2 lines:
  const acc = overlayFromHeadline('Power is the new oil of intelligence', true);
  assert.ok(acc.lines.length < 2 ? acc.accentLine === null : acc.accentLine === acc.lines.length - 1);
});

test('VI-8. prompt: composition-first reserves natural negative space for WHITE text on the text side, no overlay', () => {
  const left = buildBackgroundPrompt('a bright modern office in daylight', 'transformation', 'bright_editorial', false, 'left');
  assert.ok(/reserve a calm, uncluttered area on the LEFT/i.test(left));
  assert.ok(/WITHOUT any added overlay, scrim, gradient, vignette, or darkening/i.test(left));
  assert.ok(/a WHITE headline/i.test(left));
  const right = buildBackgroundPrompt('a bright modern lab', 'transformation', 'bright_editorial', false, 'right');
  assert.ok(/area on the RIGHT/i.test(right));   // RTL → text on the right
});

test('VI-9. prompt: hard ZERO-TEXT / no-signage guardrail', () => {
  const p = buildBackgroundPrompt('a bright bank lobby', 'collapse_fragility', 'bright_editorial', false, 'left');
  assert.ok(/ZERO TEXT/i.test(p));
  assert.ok(/no signage, labels, lettering/i.test(p));
  assert.ok(/no text on walls, screens/i.test(p));
});

test('C. prompt: editorial style + guardrails + colors free + bright default', () => {
  const p = buildBackgroundPrompt('Endless luminous data corridors converging into a vast architectural core.');
  assert.ok(p.includes('Endless luminous data corridors'));
  assert.ok(/Apple keynote, Bloomberg\/Financial Times/i.test(p));   // editorial references
  assert.ok(/must NOT appear/.test(p) && /soldiers|firefighters|fortresses/.test(p));
  assert.ok(/Colors: free/.test(p) && /Do not restrict to any brand palette/.test(p));
  assert.ok(/BRIGHT, natural daylight/i.test(p));                     // bright by default
});

test('D. provider resolution honors the disabled contract', () => {
  const orig = imageGenConfig.enabled;
  // @ts-expect-error test mutation of readonly config
  imageGenConfig.enabled = false;
  assert.equal(effectiveProvider(), 'disabled');
  // @ts-expect-error test mutation
  imageGenConfig.enabled = true;
  assert.ok(['openai', 'mock'].includes(effectiveProvider()));
  // @ts-expect-error restore
  imageGenConfig.enabled = orig;
});
