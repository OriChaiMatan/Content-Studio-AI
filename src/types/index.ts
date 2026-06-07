// ─────────────────────────────────────────────────────────────
// Domain types — designed database-first for PostgreSQL/Prisma
// ─────────────────────────────────────────────────────────────

// ── Enums ──────────────────────────────────────────────────

export type Language = 'en' | 'he';

export type SourceType = 'text' | 'url' | 'pdf';

// Simplified wizard — Goal options
export type ContentGoal =
  | 'build_authority' | 'generate_leads' | 'increase_sales'
  | 'educate_audience' | 'grow_community' | 'personal_branding' | 'other';

// Simplified wizard — Content style options
export type ContentStyle =
  | 'professional' | 'authoritative' | 'friendly' | 'personal'
  | 'journalistic' | 'provocative' | 'humorous' | 'other';

// Simplified wizard — which platforms to generate outputs for
// Note: 'images' maps to the 'image_prompt' platform in the DB
export type ContentTarget =
  | 'linkedin' | 'facebook' | 'instagram' | 'newsletter' | 'podcast' | 'images';

// A structured claim the source makes (Phase 8 new shape).
export interface Claim {
  text:                 string;
  type:                 'announcement' | 'statistic' | 'prediction' | 'opinion' | 'definition';
  subject?:             string;
  verifiable:           boolean;
  extractionConfidence: number;
  verificationStatus:   'unverified';
}

// A named entity referenced by the source.
export interface Entity {
  name: string;
  type: 'company' | 'person' | 'product' | 'technology' | 'location' | 'organization';
}

// Source analysis output. Tolerant of legacy records:
// legacy used `topics`, `confidenceScore`, `claims: string[]`.
// All new fields are optional so old records render without crashing.
export interface SourceIntelligence {
  summary:                  string;
  // New shape
  mainTopics?:              string[];
  claims?:                  Claim[] | string[];   // Claim[] (new) or string[] (legacy)
  entities?:                Entity[];
  importanceScore?:         number;
  contentAngles?:           string[];
  language?:                string;
  analysisConfidenceScore?: number;
  analysisVersion?:         string;
  truncated?:               boolean;
  analyzedAt?:              string;
  // Legacy shape (still present on old records)
  topics?:                  string[];
  confidenceScore?:         number;
  // Common
  keywords:                 string[];
  sentiment:                'positive' | 'negative' | 'neutral' | 'mixed';
}

// Lifecycle of a ContentSource.
// new     → just added, available as primary material for the next run
// used    → consumed as primary source; marked used on approval (Phase 5)
// ignored → excluded from future runs by the user
// error   → could not be processed by the pipeline
export type SourceStatus = 'new' | 'used' | 'ignored' | 'error';

export type Platform =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'newsletter'
  | 'podcast'
  | 'image_prompt';

export type CaseStatus =
  | 'draft'
  | 'research'
  | 'fact_check'
  | 'generating'
  | 'in_review'
  | 'completed';

export type OutputStatus = 'draft' | 'approved' | 'rejected';

export type ScheduleFrequency = 'manual' | 'daily' | 'weekly' | 'monthly';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';

// ── ContentSource ──────────────────────────────────────────
// Maps to: content_sources table
// Sources are added continuously over the life of a Content Case.
export interface ContentSource {
  id: string;
  contentCaseId: string;
  type: SourceType;
  label: string;
  content: string;          // text body, URL string, or original filename
  status: SourceStatus;     // lifecycle state — starts as 'new'
  usedInRunId: string | null; // run that last consumed this source (set in Phase 5)
  lastUsedAt: string | null;  // ISO 8601 — set in Phase 5
  sourceIntelligence: SourceIntelligence | null; // deterministic mock analysis
  // URL content extraction (Phase 8.5) — populated for url sources only.
  extractedTitle?: string | null;
  extractedText?: string | null;
  extractionStatus?: ExtractionStatus | null; // 'success' | 'failed' | 'skipped' | 'pending'
  extractionError?: string | null;
  extractedAt?: string | null;
  createdAt: string;          // ISO 8601
  updatedAt: string | null;   // set when a text source is edited; null otherwise
}

// Outcome of URL content extraction for a source.
// success → readable text extracted; failed → could not extract (fell back to
// URL+label analysis); skipped → not a url source; pending → not yet run.
export type ExtractionStatus = 'success' | 'failed' | 'skipped' | 'pending';

// Minimal source shape sent from the wizard (server infers all lifecycle fields).
export interface SourceInput {
  type: SourceType;
  label: string;
  content: string;
}

// ── PipelineRunSummary ─────────────────────────────────────
// Lightweight run info embedded in ContentCase responses.
export interface PipelineRunSummary {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  primarySourceIds: string[];   // new sources selected as main material
  contextSourceIds: string[];   // used sources included as background
  sourceCount: number;          // primarySourceIds.length + contextSourceIds.length
  startedAt: string;            // ISO 8601
  completedAt: string | null;
}

// ── PipelineStep ───────────────────────────────────────────
// Embedded in ContentCase — represents one pipeline stage
export interface PipelineStep {
  id: string;
  name: 'research' | 'fact_check' | 'content_creation';
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;   // mock result text
  confidence: number | null; // 0–100
}

// ── ContentOutput ──────────────────────────────────────────
// Maps to: content_outputs table
export interface ContentOutput {
  id: string;
  contentCaseId: string;
  pipelineRunId: string | null; // which run produced this output
  platform: Platform;
  title: string;
  body: string;
  status: OutputStatus;
  version: string;                // e.g. "v1.0.0"
  contentScore: number | null;    // 0–100, mock AI quality score
  researchConfidence: number | null;
  factCheckAccuracy: number | null;
  generatedAt: string;            // ISO 8601
  reviewedAt: string | null;
}

// ── Schedule ───────────────────────────────────────────────
export interface Schedule {
  frequency: ScheduleFrequency;
  time: string | null;     // "HH:MM" or null for manual
  dayOfWeek: number | null; // 0–6 for weekly; null otherwise
  dayOfMonth: number | null; // 1–31 for monthly; null otherwise
}

// ── ContentCase ────────────────────────────────────────────
// Maps to: content_cases table
export interface ContentCase {
  id: string;
  title: string;
  status: CaseStatus;
  language: Language;

  // Audience (Step 2)
  targetAudience: string;
  industry: string;
  experienceLevel: ExperienceLevel;

  // Writing (Step 3)
  writingStyle: string;
  goals: string;
  aiInstructions: string;

  // Schedule (Step 5)
  schedule: Schedule;

  // Simplified wizard fields (new cases)
  contentGoal:    ContentGoal;
  goalCustom:     string | null;
  contentStyle:   ContentStyle;
  styleCustom:    string | null;
  contentTargets: ContentTarget[];   // which platforms to generate; empty = all (legacy)

  // Relations
  sources: ContentSource[];
  outputs: ContentOutput[];
  pipeline: PipelineStep[];
  currentRun: PipelineRunSummary | null; // active or most recent pipeline run

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ── LibraryItem ────────────────────────────────────────────
// One approved ContentOutput stored permanently in the Library.
// Each item belongs to exactly one Pipeline Run.
export interface LibraryItem {
  id: string;
  contentCaseId: string;
  contentCaseName: string;
  outputId: string;
  pipelineRunId: string | null; // which run produced this item
  platform: Platform;
  title: string;
  body: string;
  status: OutputStatus;
  version: string;
  date: string;                 // ISO 8601
}

// ── LibraryRunGroup ─────────────────────────────────────────
// Library items grouped by Pipeline Run — used for run-based Library display.
export interface LibraryRunGroup {
  runId: string | null;         // null for legacy items without a run
  caseId: string;
  caseTitle: string;
  runDate: string;              // ISO 8601
  approvedCount: number;
  platforms: Platform[];
  sourceCount: number;
  items: LibraryItem[];
}

// ── User ───────────────────────────────────────────────────
// Maps to: users table
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  language: Language;
  notifications: {
    generationComplete: boolean;
    factCheckConflict: boolean;
    draftReady: boolean;
  };
  lastActiveAt: string;
  createdAt: string;
}

// ── Wizard form state — simplified 3-step wizard ──────────
export interface WizardFormData {
  // Step 1: Case Name + Goal
  title:        string;
  contentGoal:  ContentGoal;
  goalCustom:   string;
  // Step 2: Content Style + Language
  contentStyle: ContentStyle;
  styleCustom:  string;
  language:     Language;
  // Step 3: Content Targets (required, non-empty)
  contentTargets: ContentTarget[];
}

// ── UI helper types ────────────────────────────────────────
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
