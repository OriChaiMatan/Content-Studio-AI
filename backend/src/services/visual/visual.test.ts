import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCase, ContentOutput } from '@prisma/client';
import { buildVisualBrief, isRtlText, wrapHeadline } from './visualBrief';
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

test('A. brief: headline lines come from the hook; LTR for English; category classified', () => {
  const b = buildVisualBrief(fakeOutput({}), fakeCase({}));
  assert.equal(b.language, 'en');
  assert.equal(b.overlay.dir, 'ltr');
  assert.ok(b.overlay.lines.length >= 1 && b.overlay.lines.length <= 3);
  assert.equal(b.visualCategory, 'ai_infrastructure');
  assert.equal(b.overlay.emphasisLine, b.overlay.lines.length - 1);
});

test('B. brief: Hebrew case → RTL + Hebrew kicker', () => {
  const b = buildVisualBrief(fakeOutput({ breakdown: { hook: 'ההגנה האמיתית מתחילה לפני המתקפה' } as object, title: 'אבטחה' }), fakeCase({ language: 'he', title: 'אבטחת מידע' }));
  assert.equal(b.overlay.dir, 'rtl');
  assert.ok(b.overlay.kicker.length > 0);
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
  const lines = wrapHeadline(src, 30, 3);
  assert.deepEqual(lines, ['מי מייצר את השבבים,', 'ומי באמת שולט בעתיד ה-AI?']);
  // logical order preserved exactly (never reversed/reordered):
  assert.equal(lines.join(' '), src);
  // mixed token kept intact on one line:
  assert.ok(lines.some(l => l.includes('ה-AI?')));
});

test('B5. wrapHeadline: English stays ≤3 lines with words intact (order preserved)', () => {
  const src = 'The real AI war is happening at inference';
  const lines = wrapHeadline(src, 18, 3);
  assert.ok(lines.length >= 1 && lines.length <= 3);
  assert.equal(lines.join(' '), src);
});

test('C. prompt: keynote aesthetic + guardrails, NO color restriction', () => {
  const p = buildBackgroundPrompt('Endless luminous data corridors converging into a vast architectural core.');
  assert.ok(p.includes('Endless luminous data corridors'));
  assert.ok(/Apple, NVIDIA, OpenAI, or Bloomberg/.test(p));
  assert.ok(/must NOT appear/.test(p) && /soldiers|firefighters|fortresses/.test(p));
  assert.ok(/Colors: completely free/.test(p));
  assert.ok(!/brand palette\b(?!.*completely free)/i.test(p) || /Do not restrict to any brand palette/.test(p));
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
