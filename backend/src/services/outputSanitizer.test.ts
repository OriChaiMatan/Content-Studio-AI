import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeEmDashes, stripEmDashes } from './outputSanitizer';
import { GeneratedOutputSchema, type GeneratedOutput } from '../schemas/aiContractSchemas';

const EM = '—';   // — em dash
const EN = '–';   // – en dash (must be left alone)

test('A. spaced em dash "a — b" → "a, b"', () => {
  assert.equal(removeEmDashes(`a ${EM} b`), 'a, b');
});

test('B. unspaced "a—b" → "a, b"', () => {
  assert.equal(removeEmDashes(`a${EM}b`), 'a, b');
});

test('C. one-sided spacing never leaves stray " ," or double spaces', () => {
  assert.equal(removeEmDashes(`a ${EM}b`), 'a, b');
  assert.equal(removeEmDashes(`a${EM} b`), 'a, b');
});

test('D. multiple em dashes (parenthetical pair) both replaced', () => {
  assert.equal(removeEmDashes(`the idea ${EM} which is great ${EM} works`), 'the idea, which is great, works');
});

test('E. newlines are preserved (not collapsed by the dash rule)', () => {
  // tab/space around the dash is absorbed; the newline stays.
  assert.equal(removeEmDashes(`first${EM}second\nthird`), 'first, second\nthird');
});

test('F. Hebrew text: em dash → comma, surrounding letters untouched', () => {
  assert.equal(removeEmDashes(`שלום ${EM} עולם`), 'שלום, עולם');
});

test('G. en dash, hyphen, and Hebrew maqaf are LEFT ALONE', () => {
  assert.equal(removeEmDashes(`5${EN}10`), `5${EN}10`);        // number range
  assert.equal(removeEmDashes('state-of-the-art'), 'state-of-the-art'); // hyphen
  assert.equal(removeEmDashes('בית־ספר'), 'בית־ספר');  // maqaf
});

test('H. no-op when there is no em dash', () => {
  assert.equal(removeEmDashes('clean, normal text.'), 'clean, normal text.');
});

test('I. stripEmDashes cleans title, readyToPublish, breakdown strings + arrays; leaves metadata; stays schema-valid', () => {
  const dirty: GeneratedOutput = {
    platform: 'linkedin',
    title: `Title ${EM} subtitle`,
    readyToPublish: `Opening line ${EM} then more.\nSecond paragraph${EM}continues.`,
    breakdown: {
      hook: `Hook ${EM} sharp`,
      context: `Context${EM}here`,
      insight: 'No dash insight',
      takeaways: [`First ${EM} point`, 'second clean'],
      cta: `Do it ${EM} now`,
      hashtags: ['#ai', '#content'],
    },
    metadata: { generatorVersion: 'claude-gen-1', degraded: false },
  } as GeneratedOutput;

  const clean = stripEmDashes(dirty);

  assert.equal(clean.title, 'Title, subtitle');
  assert.equal(clean.readyToPublish, 'Opening line, then more.\nSecond paragraph, continues.');
  assert.equal((clean.breakdown as { hook: string }).hook, 'Hook, sharp');
  assert.equal((clean.breakdown as { context: string }).context, 'Context, here');
  assert.deepEqual((clean.breakdown as { takeaways: string[] }).takeaways, ['First, point', 'second clean']);
  assert.equal((clean.breakdown as { cta: string }).cta, 'Do it, now');

  // No em dash survives anywhere in the cleaned output.
  assert.ok(!JSON.stringify(clean).includes(EM));
  // Metadata untouched.
  assert.equal(clean.metadata.generatorVersion, 'claude-gen-1');
  // Result is still a valid GeneratedOutput.
  assert.doesNotThrow(() => GeneratedOutputSchema.parse(clean));
});
