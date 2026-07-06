export type PodcastEpisodeStatus =
  | 'pending'
  | 'generating'
  | 'pack_ready'
  | 'blueprint_ready'
  | 'critique_ready'
  | 'completed'
  | 'failed';

export interface PodcastEpisodeSummary {
  id: string;
  pipelineRunId: string;
  version: number;
  status: PodcastEpisodeStatus;
  title: string;
  subtitle: string;
  language: string;
  wordCount: number;
  estimatedDurationMin: number;
  researchDensity: string;
  qualityStatus: string | null;
  sectionsCompleted: number;
  approximateCostUsd: number | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

// Narration section as stored in the DB `sections` column (Stage 3 output).
// Field name is `name` — matches backend EpisodeSection. No sectionIndex; order is array position.
export interface EpisodeSection {
  name: string;
  narration: string;
  wordCount?: number;
}

// The `podcastPackage` DB column (Stage 5 output).
// Contains summary/outline only — narration text is in the separate `sections` column.
export interface PodcastPackage {
  executiveSummary: string;
  keyTakeaways: string[];
  outline: Array<{ name: string; wordOffset: number }>;
}

export interface PodcastEpisodeFull extends PodcastEpisodeSummary {
  researchPack: unknown;
  blueprint: unknown;
  sections: unknown;      // EpisodeSection[] from the DB `sections` column
  critique: unknown;
  podcastPackage: PodcastPackage | null;
}
