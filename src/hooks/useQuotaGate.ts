import { useAuthStore } from '../stores/authStore';
import { useUsageStore, METRIC_LABELS, type UsageMetricKey } from '../stores/usageStore';
import { useContentCasesStore } from '../stores/contentCasesStore';
import { useQuotaModalStore, type QuotaModalContent } from '../stores/quotaModalStore';
import { useActiveCaseLimitModalStore, type ActiveCaseLimitModalContent, type CaseLimitInfo } from '../stores/activeCaseLimitModalStore';
import type { ContentCase, ScheduleFrequency } from '../types';

// Shared by useActiveCaseLimitContent (create flow) and the Case Detail page's
// reactivate flow — both need the same "here's what's in this case" summary.
export function buildCaseLimitInfo(c: ContentCase): CaseLimitInfo {
  return {
    caseId: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    sourceCount: c.sources.length,
    pipelineRunCount: c.pipelineRunCount,
    outputCount: c.outputs.length,
  };
}

// Shared plan/usage gating reads. Every check here bypasses for MASTER (mirrors
// the backend's canBypassLimits) and returns null/false ("not blocked") when the
// usage summary hasn't loaded yet or a fetch failed — the backend remains the
// authoritative gate (see usageService.ts); these hooks only drive the
// PROACTIVE "open the quota modal instead of sending a doomed request" UX (see
// components/ui/QuotaLimitModal.tsx). The reactive half (backend rejects a
// request made with stale usage) is handled uniformly by the global
// 'quota:exceeded' bridge in stores/authStore.ts — both target the same modal.

export function useIsMaster(): boolean {
  return useAuthStore(s => s.user?.systemRole === 'MASTER');
}

// Returns the modal content to show if the case-creation limit is currently
// reached, or null if not (or unknown — fails open, same as before).
export function useCaseLimitContent(): QuotaModalContent | null {
  const isMaster = useIsMaster();
  const cases = useUsageStore(s => s.summary?.cases);
  const resetAt = useUsageStore(s => s.summary?.nextUsageResetAt);
  if (isMaster || !cases) return null;
  if (cases.used < cases.limit) return null;
  return { kind: 'CASE_LIMIT', label: 'Active content cases', used: cases.used, limit: cases.limit, resetAt };
}

// Richer, case-specific variant of useCaseLimitContent — returns real data
// about the user's single active case (title/updatedAt/counts) so a modal can
// show it, not just a used/limit number. Only resolves when there's exactly
// ONE unambiguous active case to point at (true for Free's maxActiveCases=1
// today); returns null otherwise (limit not reached, cases not loaded yet, or
// a Pro/Master multi-case tie) — callers fall back to the generic
// useCaseLimitContent()/QuotaLimitModal in that case (see the Content Case
// Lifecycle plan's Pro/Master note). Shared by two proactive checks — "am I
// blocked from creating a new case" (useGoToNewCase) and "am I blocked from
// reactivating this archived case" (Case Detail's Reactivate action) — each
// wraps this in the mode-specific ActiveCaseLimitModalContent shape itself.
export function useActiveCaseLimitContent(): { activeCase: ActiveCaseLimitModalContent['activeCase'] } | null {
  const isMaster = useIsMaster();
  const cases = useUsageStore(s => s.summary?.cases);
  const allCases = useContentCasesStore(s => s.cases);
  if (isMaster || !cases) return null;
  if (cases.used < cases.limit) return null;
  const activeCases = allCases.filter(c => c.lifecycleStatus === 'ACTIVE');
  if (activeCases.length !== 1) return null;
  return { activeCase: buildCaseLimitInfo(activeCases[0]) };
}

// Returns the modal content to show if the given user-scoped metric
// (PIPELINE_RUN / IMAGE_GENERATION) is currently exhausted, or null if not.
// SOURCE_ADDED is per-case, not user-scoped — build its content directly from
// the case's own `sourceUsage` field instead (see SourcesPanel.tsx).
export function useMetricLimitContent(metric: UsageMetricKey): QuotaModalContent | null {
  const isMaster = useIsMaster();
  const m = useUsageStore(s => s.summary?.metrics[metric]);
  const resetAt = useUsageStore(s => s.summary?.nextUsageResetAt);
  if (isMaster || !m) return null;
  if (m.used < m.limit) return null;
  return { kind: metric, label: METRIC_LABELS[metric].label, used: m.used, limit: m.limit, resetAt };
}

// Builds modal content for a per-case metric (currently only SOURCE_ADDED) from
// an explicitly-known used/limit pair (e.g. ContentCase.sourceUsage) rather than
// the global usage store, since the limit is per-case, not per-user.
export function buildPerCaseLimitContent(
  metric: UsageMetricKey,
  usage: { used: number; limit: number } | undefined,
  resetAt?: string,
): QuotaModalContent | null {
  if (!usage) return null;
  if (usage.used < usage.limit) return null;
  return { kind: metric, label: METRIC_LABELS[metric].label, used: usage.used, limit: usage.limit, resetAt };
}

// Bundles the "New Content Case" gate shared by the raw-navigation entry
// points (Sidebar, Dashboard, ContentCasesPage): tries the specific
// ActiveCaseLimitModal first (real data about the one active case blocking
// creation), falls back to the generic QuotaLimitModal for the Pro/Master
// multi-case edge case, otherwise navigates straight to the wizard.
// CreateCaseWizard's own submit-time re-check composes the two source hooks
// directly instead, since its "blocked" shape is return-early, not navigate.
export function useGoToNewCase(navigate: (path: string) => void): () => void {
  const activeCaseLimitContent = useActiveCaseLimitContent();
  const caseLimitContent = useCaseLimitContent();
  const showActiveCaseLimitModal = useActiveCaseLimitModalStore(s => s.show);
  const showQuotaModal = useQuotaModalStore(s => s.show);
  return () => {
    if (activeCaseLimitContent) { showActiveCaseLimitModal({ mode: 'create', activeCase: activeCaseLimitContent.activeCase }); return; }
    if (caseLimitContent) { showQuotaModal(caseLimitContent); return; }
    navigate('/cases/new');
  };
}

// Mirrors the backend's isSchedulingAllowed (usageService.ts / planDefinitions.ts)
// for the wizard/edit-form disabled-state hint. The backend remains authoritative
// (see caseService's scheduling-restriction check) — this is a UI-only convenience
// copy of a simple, stable rule, not a second source of truth for limits/numbers.
// Free blocks only 'daily'; manual/weekly/monthly are open on every plan.
export function useSchedulingAllowed(frequency: ScheduleFrequency): boolean {
  const isMaster = useIsMaster();
  const plan = useAuthStore(s => s.user?.plan);
  if (isMaster || frequency !== 'daily') return true;
  return plan === 'PRO';
}
