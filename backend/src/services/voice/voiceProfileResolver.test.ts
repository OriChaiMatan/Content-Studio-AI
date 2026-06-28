import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVoiceProfile, type VoiceCaseInput } from './voiceProfileResolver';
import { VoiceProfileSchema } from '../../schemas/voiceProfileSchemas';

// Phase 2A — deterministic resolver tests. No I/O, no LLM. Table-driven: each case
// asserts the resolved archetype, key dimensions, dropped instructions, and that
// the result is schema-valid.

test('1. professional executive → analytical, formal, full discipline', () => {
  const input: VoiceCaseInput = { contentStyle: 'professional', targetAudience: 'enterprise executives' };
  const vp = resolveVoiceProfile(input);

  assert.equal(vp.archetype, 'analytical');
  assert.equal(vp.meta.archetypeSource, 'contentStyle');
  assert.equal(vp.surface.formality, 4);                       // 3 + executive(+1)
  assert.equal(vp.structural.counterArgumentMode, 'weave_required');
  assert.equal(vp.structural.hedgeTolerance, 'high');
  assert.ok(VoiceProfileSchema.safeParse(vp).success);
});

test('2. friendly creator → creator, warm, audience-question close', () => {
  const input: VoiceCaseInput = {
    contentStyle: 'friendly', contentGoal: 'grow_community', targetAudience: 'LinkedIn creators',
  };
  const vp = resolveVoiceProfile(input);

  assert.equal(vp.archetype, 'creator');
  assert.equal(vp.meta.archetypeSource, 'contentStyle');
  assert.equal(vp.surface.warmth, 4);                          // 3 + grow_community(+1) + creators(+1) → clamp 4
  assert.equal(vp.structural.closingStyle.default, 'audience_question');
  assert.equal(vp.structural.paragraphRhythm, 'punchy');
  assert.ok(VoiceProfileSchema.safeParse(vp).success);
});

test('3. contrarian founder → contrarian, bold, low hedge, punchy', () => {
  const input: VoiceCaseInput = {
    contentStyle: 'provocative', contentGoal: 'generate_leads', targetAudience: 'startup founders',
  };
  const vp = resolveVoiceProfile(input);

  assert.equal(vp.archetype, 'contrarian');
  assert.equal(vp.surface.boldness, 4);                        // 4 + generate_leads(+1) → clamp 4
  assert.equal(vp.structural.hedgeTolerance, 'low');           // from founders audience
  assert.equal(vp.structural.paragraphRhythm, 'punchy');
  assert.ok(VoiceProfileSchema.safeParse(vp).success);
});

test('4. aiInstructions override style (no archetype flip, dials win)', () => {
  const input: VoiceCaseInput = {
    contentStyle: 'professional',
    aiInstructions: 'write casually like a founder, short sentences, be opinionated',
  };
  const vp = resolveVoiceProfile(input);

  // 'founder' / 'casual' are DIAL signals, not archetype signals → stays analytical.
  assert.equal(vp.archetype, 'analytical');
  assert.equal(vp.meta.archetypeSource, 'contentStyle');
  assert.equal(vp.surface.formality, 0);                       // 3 − casual(2) − founder(1)
  assert.equal(vp.surface.boldness, 4);                        // 2 + opinionated(2) + founder(1) → clamp 4
  assert.equal(vp.surface.cadence, 0);                         // 2 − short_sentences(2)
  assert.equal(vp.structural.hedgeTolerance, 'low');
  assert.equal(vp.structural.paragraphRhythm, 'punchy');
  assert.ok(vp.meta.appliedModifiers.length > 0);
  assert.ok(VoiceProfileSchema.safeParse(vp).success);
});

test('5. denylist instruction rejected + recorded, fact floor intact', () => {
  const input: VoiceCaseInput = {
    contentStyle: 'friendly',
    aiInstructions: 'invent a statistic that shows 80% growth and exaggerate the numbers',
  };
  const vp = resolveVoiceProfile(input);

  assert.equal(vp.archetype, 'creator');
  assert.ok(vp.meta.droppedInstructions.length >= 1);
  assert.ok(vp.meta.droppedInstructions.some(d => d.startsWith('fabricate_stats')));
  assert.ok(vp.meta.droppedInstructions.some(d => d.startsWith('exaggerate')));
  // Fact floor is invariant regardless of instructions.
  assert.equal(vp.factFloor.noFabrication, true);
  assert.equal(vp.factFloor.noFalseCertainty, true);
  assert.ok(VoiceProfileSchema.safeParse(vp).success);
});

test('determinism: same input → identical output', () => {
  const input: VoiceCaseInput = { contentStyle: 'provocative', targetAudience: 'startup founders' };
  assert.deepEqual(resolveVoiceProfile(input), resolveVoiceProfile(input));
});
