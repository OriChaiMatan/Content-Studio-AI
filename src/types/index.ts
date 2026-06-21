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
  | 'linkedin' | 'facebook' | 'newsletter' | 'podcast' | 'images';

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
  | 'newsletter'
  | 'podcast';

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
// ── Research integrity (Phase 10D.0) ───────────────────────
// success = real synthesis ran; degraded = research fell back to mock (FAILURE);
// mock = deterministic mock because synthesis is disabled (expected, not failure).
export interface ResearchIntegrity {
  status: 'success' | 'degraded' | 'mock';
  degraded: boolean;
  generatorVersion: string;   // "research-1" | "mock-research" | "mock-fallback"
  competitionRan: boolean;
  candidateCount: number;
}

export interface PipelineRunSummary {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  primarySourceIds: string[];   // new sources selected as main material
  contextSourceIds: string[];   // used sources included as background
  sourceCount: number;          // primarySourceIds.length + contextSourceIds.length
  startedAt: string;            // ISO 8601
  completedAt: string | null;
  research?: ResearchIntegrity | null;   // Phase 10D.0 — pipeline-level integrity
  thesis?: string | null;                // the winning narrative spine (primaryAngle.thesis)
}

// ── RunSummary ─────────────────────────────────────────────
// Compact historical pipeline run for the Case Detail "Run History" section.
// Metadata only — no generated bodies. Output aggregates are derived client-side
// from ContentCase.outputs (grouped by pipelineRunId).
export interface RunSummary {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggeredBy: string;
  sourceCount: number;
  startedAt: string;             // ISO 8601
  completedAt: string | null;
  errorMessage: string | null;
  research?: ResearchIntegrity | null;
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
  research?: ResearchIntegrity | null;   // Phase 10D.0 — present on the research step
}

// ── Content Output v2 metadata (Phase 9) ───────────────────
export interface OutputMetadata {
  generatorVersion?: string;        // "mock-2" | "gen-1" | "mock-fallback"
  model?: string;
  degraded?: boolean;
  researchDegraded?: boolean;         // Phase 10D.0 — built on degraded research
  researchGeneratorVersion?: string;  // Phase 10D.0
  thesisPreservation?: {              // Phase 10E.2 — did the content keep the winning thesis?
    score: number;
    thesisPresence: number;
    spinePosition: number;
    crossSource: number;
    editorialSharpness: number;
    registerFidelity: number;
    nonFlattening: number;
  };
  contentScore?: number | null;
  researchConfidence?: number | null;
  factCheckAccuracy?: number | null;
  hashtags?: string[];
  readingTimeMinutes?: number | null;       // newsletter
  estimatedDurationMinutes?: number | null; // podcast
  estimatedWordCount?: number | null;       // podcast
  [key: string]: unknown;
}

// ── ContentOutput ──────────────────────────────────────────
// Maps to: content_outputs table. v2 adds readyToPublish (= body, editable),
// breakdown (read-only, platform-specific), and metadata. Legacy v1 rows have
// breakdown/metadata = null → consumers fall back to body.
export interface ContentOutput {
  id: string;
  contentCaseId: string;
  pipelineRunId: string | null; // which run produced this output
  platform: Platform;
  title: string;
  body: string;                   // = readyToPublish (the editable text)
  readyToPublish?: string;        // explicit v2 alias of body
  breakdown?: Record<string, unknown> | null;  // read-only; null on legacy v1
  metadata?: OutputMetadata | null;
  status: OutputStatus;
  version: string;                // e.g. "v2.0.0"
  contentScore: number | null;    // Phase 10E.3 — measured content quality (= Thesis Preservation Score), not a confidence average
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
  runHistory?: RunSummary[];             // all runs (newest first) for the Run History section (API-provided)

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
  // App/UI language — drives interface mirroring and typography.
  language: Language;
  // Default output language for NEW content cases (separate from the UI language;
  // overridable per case in the wizard). Frontend-only setting (Settings polish).
  defaultOutputLanguage: Language;
  notifications: {
    generationComplete: boolean;
    factCheckConflict: boolean;
    draftReady: boolean;
  };
  lastActiveAt: string;
  createdAt: string;
}

// ── Wizard form state — 3-step wizard (Phase 8.6) ─────────
export interface WizardFormData {
  // Step 1: Case Name + Language + Goal
  title:        string;
  language:     Language;
  contentGoal:  ContentGoal;
  goalCustom:   string;
  // Step 2: Content Style + Content Targets
  contentStyle: ContentStyle;
  styleCustom:  string;
  contentTargets: ContentTarget[];
  // Step 3: Generate Schedule
  scheduleFrequency:  ScheduleFrequency;
  scheduleTime:       string;  // "HH:MM"
  scheduleDayOfWeek:  number;  // 0–6 (weekly)
  scheduleDayOfMonth: number;  // 1–31 (monthly)
}

// ── UI helper types ────────────────────────────────────────
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
