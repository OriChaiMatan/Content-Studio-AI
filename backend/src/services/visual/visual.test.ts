import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentCase, ContentOutput } from '@prisma/client';
import { buildVisualBrief, isRtlText, wrapHeadline, overlayFromHeadline, buildOverlay } from './visualBrief';
import {
  analyzeVisual, humansAllowed, isCliche, grammarConsistent, passesInvariants,
  labelCount, VISUAL_GRAMMARS, type VisualPlan,
} from './visualIntelligence';
import { buildImagePrompt } from './visualPrompt';
import { critiqueRenders } from './renderCritic';
import { ART_DIRECTION, PALETTE, LAYOUTS, LAYOUT_PRESETS, resolveSides } from './lumaiDesign';
import { placeLabels, textZoneRect } from './labelGeometry';
import { effectiveProvider, imageGenConfig } from '../../lib/visualConfig';

function fakeOutput(p: Partial<ContentOutput>): ContentOutput {
  return { id: 'o1', contentCaseId: 'c1', platform: 'linkedin', title: 'The real AI war is happening at inference',
    body: '...', status: 'draft', breakdown: { hook: 'The real AI war is happening at inference', insight: 'Inference economics decide the winners' },
    metadata: null, ...p } as unknown as ContentOutput;
}
function fakeCase(p: Partial<ContentCase>): ContentCase {
  return { id: 'c1', title: 'AI infra', contentGoal: 'thought_leadership', language: 'en', ...p } as unknown as ContentCase;
}

// A hand-built RELATIONSHIP plan (nominal vs real value) that clears the lean safeguards.
function goodPlan(p: Partial<VisualPlan> = {}): VisualPlan {
  return {
    thesis: 'Nominal recovery masks a near-flat real return.',
    mechanism: 'apparent gains disguise the tiny real value beneath them',
    visualGrammar: 'relationship',
    scene: 'a glass appearing full of clear water above a thick false bottom leaving only a sliver of real value',
    visualGroups: [
      { description: 'a tall glass appearing almost full of clear water', label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' },
      { description: 'a thick false bottom leaving a thin real layer', label: null, labelPosition: 'bottom', anchor: 'VISUAL_SECONDARY' },
    ],
    backgroundFamily: 'SOFT_STUDIO',
    layout: 'RIGHT_HEAVY',
    allowHumans: false,
    headline: 'Four Years. Two Percent.',
    supportingLine: 'Nominal gains look good on paper. Real returns tell a different story.',
    source: 'test',
    ...p,
  };
}

// ── Brief / overlay / RTL / Chromium-input (preserved) ──────────────────────────

test('A. brief: headline lines from the hook; LTR for English; default layout', () => {
  const b = buildVisualBrief(fakeOutput({}), fakeCase({}));
  assert.equal(b.language, 'en');
  assert.equal(b.overlay.dir, 'ltr');
  assert.ok(b.overlay.lines.length >= 1 && b.overlay.lines.length <= 3);
  assert.ok((LAYOUTS as readonly string[]).includes(b.overlay.layout));
});

test('B. brief: Hebrew case → RTL (renderer still supports it)', () => {
  const b = buildVisualBrief(fakeOutput({ breakdown: { hook: 'ההגנה האמיתית מתחילה לפני המתקפה' } as object, title: 'אבטחה' }), fakeCase({ language: 'he', title: 'אבטחת מידע' }));
  assert.equal(b.overlay.dir, 'rtl');
});

test('B2. RTL detected from TEXT even when the case is mislabeled en', () => {
  assert.equal(isRtlText('מי מייצר את השבבים'), true);
  assert.equal(isRtlText('The real AI war'), false);
  const b = buildVisualBrief(fakeOutput({ breakdown: { hook: 'מי מייצר את השבבים, ומי באמת שולט בעתיד ה-AI?' } as object, title: 'AI' }), fakeCase({ language: 'en' }));
  assert.equal(b.overlay.dir, 'rtl');
  assert.equal(b.overlay.lines.join(' ').replace(/\s+/g, ' ').trim(), 'מי מייצר את השבבים, ומי באמת שולט בעתיד ה-AI?');
});

test('B5. wrapHeadline: English ≤3 lines, words intact', () => {
  const src = 'The real AI war is happening at inference';
  const lines = wrapHeadline(src, 3);
  assert.ok(lines.length >= 1 && lines.length <= 3);
  assert.equal(lines.join(' '), src);
});

test('OV. buildOverlay: headline + paragraph + layout + labels', () => {
  const o = buildOverlay('Four Years. Two Percent.', 'Nominal gains look good on paper.', 'RIGHT_HEAVY', [{ text: 'Real', anchor: 'VISUAL_SECONDARY', position: 'right' }]);
  assert.equal(o.dir, 'ltr');
  assert.equal(o.body, 'Nominal gains look good on paper.');
  assert.deepEqual(o.labels, [{ text: 'Real', anchor: 'VISUAL_SECONDARY', position: 'right' }]);
  assert.equal(overlayFromHeadline('Headline only').body, null);
});

test('LAY. text-zone side is a layout decision, independent of RTL', () => {
  assert.equal(resolveSides('RIGHT_HEAVY', true).textSide, 'left');
  assert.equal(resolveSides('LEFT_HEAVY', true).textSide, 'right');
  assert.equal(resolveSides('CENTER_BALANCED', false).textSide, 'left');
});

// ── Sprint 10 — LEAN planner (cliché + grammar + sanity only; no quality proxies) ──

test('GRAMMAR. object | relationship | system; consistency is the only structural gate', () => {
  assert.deepEqual([...VISUAL_GRAMMARS], ['object', 'relationship', 'system']);
  assert.equal(grammarConsistent(goodPlan()), true);
  assert.equal(grammarConsistent(goodPlan({ visualGroups: [{ description: 'one object', label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' }] })), false); // relationship needs 2
  assert.equal(grammarConsistent(goodPlan({ visualGrammar: 'system', scene: 'a conveyor belt endlessly reloading' })), true);
  assert.equal(grammarConsistent(goodPlan({ visualGrammar: 'system', scene: 'a single still cube', visualGroups: [{ description: 'a still cube', label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' }] })), false);
});

test('CLICHE. template + topic clichés are rejected', () => {
  assert.equal(isCliche(goodPlan()), false);
  assert.equal(isCliche(goodPlan({ scene: 'a balance scale weighing two stacked blocks' })), true);
  assert.equal(isCliche(goodPlan({ scene: 'a wall calendar with meeting invites' })), true);
  assert.equal(isCliche(goodPlan({ scene: 'a generic saas dashboard on a laptop' })), true);
});

test('INV. passesInvariants = not cliché + grammar-consistent + thesis/headline sanity (nothing else)', () => {
  assert.equal(passesInvariants(goodPlan()), true);
  assert.equal(passesInvariants(goodPlan({ scene: 'a giant funnel' })), false);   // cliché
  assert.equal(passesInvariants(goodPlan({ visualGroups: [{ description: 'one object', label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' }] })), false); // grammar
  assert.equal(passesInvariants(goodPlan({ headline: '' })), false);              // sanity
  assert.equal(passesInvariants(goodPlan({ thesis: '' })), false);                // sanity
  // A missing paragraph is NOT rejected (paragraph is optional; the critic judges quality).
  assert.equal(passesInvariants(goodPlan({ supportingLine: null })), true);
});

test('NOSCORES. no text-side quality-proxy fields survive on the plan', () => {
  const p = goodPlan();
  for (const dead of ['frames', 'concepts', 'strangerReads', 'physicalConsequence', 'worksWithoutLabels', 'quality', 'candidates']) {
    assert.ok(!(dead in p), `deleted field leaked: ${dead}`);
  }
});

test('LABELS. default is no labels; ≤ 2 kept, each ≤ 2 words (enforced in analyzeVisual coercion)', async () => {
  // Offline plan has zero labels by default.
  const off = await analyzeVisual({ thesis: 'x', title: 'The Real Trade', lang: 'en' }, 'business_strategy');
  assert.equal(labelCount(off), 0);
});

test('OFFLINE. no client → minimal safe plan (English headline, no analogy template)', async () => {
  const plan = await analyzeVisual({ thesis: 'Most damage is invisible', hook: 'the real harm is hidden', title: 'The Invisible Damage', lang: 'en' }, 'business_strategy');
  assert.ok(plan.source.startsWith('fallback:'));
  assert.ok(plan.headline.trim().length > 0);
  assert.ok(!/[֐-׿]/.test(plan.headline));   // English-only output
  assert.ok(!/iceberg|treadmill|funnel|scale/i.test(plan.scene));
});

test('G2. humansAllowed: forbidden for infra/finance; allowed for leadership + human dynamics', () => {
  assert.equal(humansAllowed('ai_infrastructure', 'compute is the bottleneck'), false);
  assert.equal(humansAllowed('leadership', 'silence is a decision'), true);
  assert.equal(humansAllowed('business_strategy', 'great hiring beats great strategy'), true);
});

// ── Render Critic (new) ─────────────────────────────────────────────────────────

test('CRITIC. degenerate inputs: 0 → reject-all; 1 → ships it; no client → ships candidate 0', async () => {
  assert.equal((await critiqueRenders([], goodPlan())).rejectAll, true);
  const one = await critiqueRenders([Buffer.from('x')], goodPlan());
  assert.equal(one.winnerIndex, 0);
  assert.equal(one.rejectAll, false);
  // With SOURCE_ANALYSIS disabled in tests there is no vision client → safe default = 0.
  const two = await critiqueRenders([Buffer.from('a'), Buffer.from('b')], goodPlan());
  assert.equal(two.source, 'no-client');
  assert.equal(two.winnerIndex, 0);
});

// ── Prompt: clean-white premium 3D art direction, grammar hint, < 900 ───────────

test('APROMPT. final prompt is < 900 chars even for oversized fields', () => {
  assert.ok(buildImagePrompt(goodPlan()).length < 900);
  const huge = goodPlan({ scene: 'x '.repeat(300).trim(), visualGroups: [{ description: 'y '.repeat(300).trim(), label: null, labelPosition: 'top', anchor: 'VISUAL_MAIN' }, { description: 'z '.repeat(300).trim(), label: null, labelPosition: 'top', anchor: 'VISUAL_SECONDARY' }] });
  assert.ok(buildImagePrompt(huge).length < 900);
});

test('STYLE. Apple/Stripe/OpenAI × premium 3D × pure white', () => {
  const p = buildImagePrompt(goodPlan());
  assert.ok(p.startsWith(ART_DIRECTION));
  assert.ok(/3D render/.test(p));
  assert.ok(/PURE-WHITE|pure-white/.test(p));
  assert.equal(PALETTE.ground, '#FFFFFF');
  assert.equal(PALETTE.anchor, '#000000');
});

test('DPROMPT. structured: ONE IDEA / GRAMMAR / COMPOSITION / SUBJECTS, TEXT-FREE', () => {
  const p = buildImagePrompt(goodPlan());
  assert.ok(/ONE IDEA: a glass appearing full/.test(p));
  assert.ok(/GRAMMAR \(relationship\): show TWO distinct subjects/.test(p));
  assert.ok(/SUBJECTS \(max 3, blank & text-free\):/.test(p));
  assert.ok(/No text, letters, numbers, logos or signage/.test(p));
});

test('G. human policy — no people by default; secondary/non-identifiable when allowed', () => {
  assert.ok(/ No people\./.test(buildImagePrompt(goodPlan({ allowHumans: false }))));
  assert.ok(/Any people must be secondary and non-identifiable\./.test(buildImagePrompt(goodPlan({ allowHumans: true }))));
});

// ── Label geometry (preserved) ──────────────────────────────────────────────────

test('GEO. placeLabels keeps chips out of the text zone', () => {
  const W = 1200, H = 630;
  const labels = [{ text: 'Real', anchor: 'VISUAL_SECONDARY' as const, position: 'right' as const }];
  const res = placeLabels(labels, 'RIGHT_HEAVY', false, W, H);
  const zone = textZoneRect('RIGHT_HEAVY', false, W, H);
  for (const p of res.filter(x => x.show)) assert.ok((p.cxPct / 100) * W > zone.l + zone.w - 1);
  void LAYOUT_PRESETS;
});

// ── Provider resolution ─────────────────────────────────────────────────────────

test('PROV. provider resolution honors the disabled contract', () => {
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
