// ─────────────────────────────────────────────────────────────────────────────
// Phase 3A — Evaluation harness types
//
// A fixture is data only: the source(s), their pre-baked sourceIntelligence cards
// (the ground-truth "source cards"), and a ground-truth annotation of what is
// supported vs planted-and-unsupported. The harness fabricates in-memory case/
// source/run objects from this and drives the REAL generation services — no DB.
// ─────────────────────────────────────────────────────────────────────────────

export type Persona = 'analytical' | 'creator' | 'contrarian';

export interface FixtureSource {
  label: string;
  type: 'text' | 'url' | 'pdf';
  content: string;
  // Pre-baked source card (shape-tolerant; read by research synthesis + generator
  // aggregation). Kept loose on purpose — it is stored as JSON in production.
  sourceIntelligence: Record<string, unknown>;
}

export interface PlantedClaim {
  // Human-readable description of the unsupported claim.
  text: string;
  // Deterministic detection anchors (case-insensitive substring match). Prefer a
  // distinctive number/proper-noun that survives translation (e.g. "73%").
  detect: string[];
  // Why it is unsupported / why a real fact check should NOT mark it verified.
  why: string;
}

export interface EvalFixture {
  id: string;
  sourceMode: 'single' | 'multi';
  caseBase: {
    title: string;
    contentGoal: string;          // ContentGoal enum value
    language: 'en' | 'he';
    contentTargets: string[];     // first one is used as the platform
  };
  sources: FixtureSource[];
  groundTruth: {
    supportedClaims: string[];
    unsupportedClaims: PlantedClaim[];
    knownContradictions?: { a: string; b: string }[];
    riskAreas: string[];
  };
}
