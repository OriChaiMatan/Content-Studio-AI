import { create } from 'zustand';
import { api } from '../lib/api';

// Mirrors backend/src/services/usageService.ts's UsageSummary (GET /api/usage).
// Deliberately NOT persisted (unlike settingsStore) — this is live, frequently-
// changing data, not a user preference to cache across sessions.
export type UsageMetricKey = 'PIPELINE_RUN' | 'SOURCE_ADDED' | 'IMAGE_GENERATION';
export interface UsageMetricSummary { used: number; limit: number }

// Shared human labels for each metric — used by the Settings dashboard and the
// quota-limit modal so the two surfaces never drift out of sync. Phrased around
// the actual usage-cycle model (a rolling per-user window, not a calendar
// month) rather than anything that reads as monthly/subscription billing.
export const METRIC_LABELS: Record<UsageMetricKey, { label: string; icon: string }> = {
  PIPELINE_RUN: { label: 'Pipeline runs every 7 days', icon: 'auto_awesome' },
  SOURCE_ADDED: { label: 'Sources per usage cycle', icon: 'article' },
  IMAGE_GENERATION: { label: 'Image generations every 7 days', icon: 'image' },
};
export interface UsageSummary {
  plan: 'FREE' | 'PRO';
  planStatus: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'SUSPENDED' | 'TRIAL';
  nextUsageResetAt: string;
  cases: UsageMetricSummary;
  metrics: Record<UsageMetricKey, UsageMetricSummary>;
}

interface UsageState {
  summary: UsageSummary | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  clear: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const summary = await api.get<UsageSummary>('/usage');
      set({ summary, loading: false });
    } catch (err) {
      // Non-fatal — the dashboard/disabled-states just fall back to "unknown"
      // (nothing gets incorrectly disabled; see useQuotaGate).
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load usage' });
    }
  },

  clear: () => set({ summary: null, loading: false, error: null }),
}));
