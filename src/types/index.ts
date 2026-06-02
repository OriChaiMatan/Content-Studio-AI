// ─────────────────────────────────────────────────────────────
// Domain types — designed database-first for PostgreSQL/Prisma
// ─────────────────────────────────────────────────────────────

// ── Enums ──────────────────────────────────────────────────

export type Language = 'en' | 'he';

export type SourceType = 'text' | 'url' | 'pdf';

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
  content: string;         // text body, URL string, or original filename
  createdAt: string;       // ISO 8601
  updatedAt: string | null; // set when a text source is edited; null otherwise
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

  // Relations
  sources: ContentSource[];
  outputs: ContentOutput[];
  pipeline: PipelineStep[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ── LibraryItem ────────────────────────────────────────────
// Maps to: library_items view / table (approved outputs surfaced globally)
export interface LibraryItem {
  id: string;
  contentCaseId: string;
  contentCaseName: string;
  outputId: string;
  platform: Platform;
  title: string;
  body: string;
  status: OutputStatus;
  version: string;
  date: string;            // ISO 8601
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

// ── Wizard form state (not persisted until submit) ─────────
export interface WizardFormData {
  // Step 1
  title: string;
  language: Language;
  // Step 2
  targetAudience: string;
  industry: string;
  experienceLevel: ExperienceLevel;
  // Step 3
  writingStyle: string;
  goals: string;
  aiInstructions: string;
  // Step 4 — initial sources (optional; more can be added after case creation)
  sources: Omit<ContentSource, 'id' | 'contentCaseId' | 'createdAt' | 'updatedAt'>[];
  // Step 5
  schedule: Schedule;
}

// ── UI helper types ────────────────────────────────────────
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
