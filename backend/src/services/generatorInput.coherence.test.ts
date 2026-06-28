import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLowCoherence, dropOutOfScope } from './generatorInput';

// Phase 4A.2 — coherence scoping helpers. Pure/deterministic.

test('isLowCoherence: low / multi-topic / high-risk → true', () => {
  assert.equal(isLowCoherence({ label: 'low', forcedSynthesisRisk: 'high' }), true);
  assert.equal(isLowCoherence({ label: 'multi-topic', forcedSynthesisRisk: 'high' }), true);
  assert.equal(isLowCoherence({ label: 'partial', forcedSynthesisRisk: 'high' }), true);   // risk gate
});

test('isLowCoherence: coherent / partial-medium / missing → false', () => {
  assert.equal(isLowCoherence({ label: 'coherent', forcedSynthesisRisk: 'low' }), false);
  assert.equal(isLowCoherence({ label: 'partial', forcedSynthesisRisk: 'medium' }), false);
  assert.equal(isLowCoherence(null), false);
  assert.equal(isLowCoherence(undefined), false);
});

test('dropOutOfScope: removes claims matching out-of-scope statements, keeps in-scope', () => {
  const items = [
    { claim: 'A national soccer league signed a $2.1B streaming rights deal.' },
    { claim: 'Shifting rainfall could cut wheat yields by up to 12% over the next decade.' },
    { claim: 'Brightpay priced its IPO at the top of its range, raising $900 million.' },
  ];
  const outOfScope = [
    'Shifting rainfall could cut wheat yields by up to 12% over the next decade.',
    'Brightpay priced its IPO at the top of its range, raising $900 million.',
  ];
  const kept = dropOutOfScope(items, outOfScope).map(i => i.claim);
  assert.equal(kept.length, 1);
  assert.match(kept[0], /soccer/);
});

test('dropOutOfScope: no out-of-scope statements → returns items unchanged (high-coherence path)', () => {
  const items = [{ claim: 'anything' }, { claim: 'else' }];
  assert.deepEqual(dropOutOfScope(items, []), items);
});

test('dropOutOfScope: paraphrase containment is caught (claim contains the out-of-scope fact)', () => {
  const items = [{ claim: 'Notably, Brightpay priced its IPO at the top of its range, raising $900 million on debut.' }];
  const out = ['Brightpay priced its IPO at the top of its range, raising $900 million'];
  assert.equal(dropOutOfScope(items, out).length, 0);
});
