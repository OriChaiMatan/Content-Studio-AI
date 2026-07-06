// LumAI Podcast Engine — Phase 1 AI Spike
// Type contracts for every stage artifact.
// No Zod for spike speed; production engine will add schema validation.

export type ResearchDensity = 'high' | 'medium' | 'limited';
export type PodcastVerdict = 'recommended' | 'not-recommended';
export type ClaimConfidence = 'verified' | 'reported' | 'uncertain';

export type SectionName =
  | 'Opening' | 'Background' | 'Context' | 'The Problem' | 'The Story'
  | 'Main Analysis' | 'The Argument' | 'Deep Dive' | 'The Evidence'
  | 'Implications' | 'What This Means' | 'The Stakes'
  | 'Looking Ahead' | 'What Comes Next'
  | 'Closing' | 'Final Thoughts';

export const VALID_SECTION_NAMES: SectionName[] = [
  'Opening', 'Background', 'Context', 'The Problem', 'The Story',
  'Main Analysis', 'The Argument', 'Deep Dive', 'The Evidence',
  'Implications', 'What This Means', 'The Stakes',
  'Looking Ahead', 'What Comes Next',
  'Closing', 'Final Thoughts',
];

// ── Stage 1: Research Pack ────────────────────────────────────────────────────

export interface ResearchClaim {
  text: string;
  confidence: ClaimConfidence;
  sourceRef?: string;
}

export interface ResearchNotes {
  verifiedFacts: Array<{ fact: string; source?: string }>;
  primarySources: string[];
  importantEntities: string[];
  openQuestions: string[];
  lowerConfidenceClaims: string[];
}

export interface ResearchPack {
  thesis: string;
  audience: string;
  language: 'en' | 'he';
  claims: ResearchClaim[];
  keyFacts: string[];
  keyNumbers: string[];
  importantEntities: string[];
  sourceRefs: string[];
  counterarguments: string[];
  openQuestions: string[];
  researchDensity: ResearchDensity;
  podcastRecommendation: { verdict: PodcastVerdict; reason: string };
  researchNotes: ResearchNotes;
}

// ── Stage 2: Blueprint ────────────────────────────────────────────────────────

export interface BlueprintSection {
  name: SectionName;
  objective: string;
  wordBudget: number;
  beats: string[];
}

export interface Blueprint {
  title: string;
  subtitle: string;
  openingAngle: string;
  narrativeShape: string;
  durationEstimateMin: number;
  estimatedWordCount: number;
  sections: BlueprintSection[];
  noRepeatLedgerSeed: string[];
  closingDirection: string;
}

// ── Stage 3: Episode Sections ─────────────────────────────────────────────────

export interface Annotation {
  type: 'pause' | 'emphasis' | 'breath';
  charOffset: number;
  value?: string;
}

export interface EpisodeSection {
  name: SectionName;
  narration: string;
  annotations: Annotation[];
  coveredPoints: string[];
  wordCount: number;
}

// ── Stage 4: Critic ───────────────────────────────────────────────────────────

export interface CriticDimension {
  score: number;
  findings: string;
}

// qualityStatus is derived from factualIntegrity score:
//   blocked      → factualIntegrity < 7 (hallucination or serious factual failure)
//   needs_review → factualIntegrity >= 7 but overall < 8, or issues present
//   pass         → factualIntegrity >= 7 and overall >= 8
export type QualityStatus = 'pass' | 'needs_review' | 'blocked';

export interface CriticReport {
  thesisClarity: CriticDimension;
  openingStrength: CriticDimension;
  factualIntegrity: CriticDimension;
  spokenNaturalness: CriticDimension;
  narrativeCoherence: CriticDimension;
  retellTestReadiness: CriticDimension;
  overallScore: number;
  verdict: 'PASS' | 'NEEDS WORK';
  qualityStatus: QualityStatus;
  numericLintFindings: string[];
  topIssues: string[];
}

// ── Stage 5: Package ──────────────────────────────────────────────────────────

export interface EpisodeOutlineItem {
  name: SectionName;
  wordOffset: number;
}

export interface PodcastPackage {
  executiveSummary: string;
  keyTakeaways: string[];
  outline: EpisodeOutlineItem[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface StageTelemetry {
  stage: string;
  model: string;
  elapsedMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface EpisodeTelemetry {
  totalElapsedMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  callCount: number;
  approximateCostUsd: number;
  stages: StageTelemetry[];
}

// ── Final Episode ─────────────────────────────────────────────────────────────

export interface Episode {
  id: string;
  runId?: string;
  caseId?: string;
  language: 'en' | 'he';
  generatedAt: string;
  title: string;
  subtitle: string;
  executiveSummary: string;
  keyTakeaways: string[];
  outline: EpisodeOutlineItem[];
  sections: EpisodeSection[];
  researchNotes: ResearchNotes;
  critique: CriticReport;
  estimatedDurationMin: number;
  wordCount: number;
  researchDensity: ResearchDensity;
  telemetry: EpisodeTelemetry;
}

// ── Spike runner input ────────────────────────────────────────────────────────

export interface DbRunInput {
  kind: 'db-run';
  runId: string;
}

export interface FixtureInput {
  kind: 'fixture';
  label: string;
  language: 'en' | 'he';
  caseTitle: string;
  caseAudience: string;
  pack: ResearchPack;
}

export type SpikeInput = DbRunInput | FixtureInput;
