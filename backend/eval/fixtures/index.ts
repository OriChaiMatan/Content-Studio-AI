import type { EvalFixture } from '../types';
import { cleanFixture } from './clean';
import { thinFixture } from './thin';
import { adversarialFixture } from './adversarial';
import { multiTensionFixture } from './multiTension';

// The full Phase 3A baseline set. Capture and score both read from here, so the
// matrix is defined in exactly one place. Order is the report order.
export const ALL_FIXTURES: EvalFixture[] = [
  cleanFixture,
  thinFixture,
  adversarialFixture,
  multiTensionFixture,
];

export const FIXTURE_BY_ID: Record<string, EvalFixture> = Object.fromEntries(
  ALL_FIXTURES.map(f => [f.id, f]),
);
