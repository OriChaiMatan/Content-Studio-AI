import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { buildNextVersionData } from './podcastEpisodeService';

const BASE = {
  contentCaseId: 'case-1',
  pipelineRunId: 'run-1',
  researchPack: { thesis: 'AI in healthcare', language: 'en' } as Prisma.JsonValue,
};

test('regenerate: new version number is nextVersion param', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.equal(data.version, 2);
});

test('regenerate: version 1 → create with nextVersion=2', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.equal(data.version, 2);
  // Simulates createNextVersion(v1) when max=1 → nextVersion=2
});

test('regenerate: researchPack is copied from source', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.deepEqual(data.researchPack, BASE.researchPack);
});

test('regenerate: null researchPack becomes Prisma.JsonNull (not undefined)', () => {
  const data = buildNextVersionData({ ...BASE, researchPack: null }, 2);
  assert.equal(data.researchPack, Prisma.JsonNull);
});

test('regenerate: blueprint absent so runner starts at Stage 2', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('blueprint' in data), 'blueprint must be absent');
});

test('regenerate: sections absent', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('sections' in data), 'sections must be absent');
});

test('regenerate: sectionsCompleted absent (defaults to 0 in DB)', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('sectionsCompleted' in data), 'sectionsCompleted must be absent');
});

test('regenerate: critique absent', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('critique' in data), 'critique must be absent');
});

test('regenerate: podcastPackage absent', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('podcastPackage' in data), 'podcastPackage must be absent');
});

test('regenerate: contentCaseId and pipelineRunId preserved', () => {
  const data = buildNextVersionData(BASE, 3);
  assert.equal(data.contentCaseId, 'case-1');
  assert.equal(data.pipelineRunId, 'run-1');
});

test('regenerate: status not set (schema default pending fires)', () => {
  const data = buildNextVersionData(BASE, 2);
  assert.ok(!('status' in data), 'status must be absent so schema @default(pending) applies');
});
