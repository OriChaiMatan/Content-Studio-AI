import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCase, ContentOutput } from '@prisma/client';
import { buildVisualBrief } from './visualBrief';
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
