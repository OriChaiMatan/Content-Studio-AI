import { create } from 'zustand';

// Roles/Plans/Usage — the primary UX for a reached limit. Replaces hard-
// disabling action buttons: buttons stay clickable, and clicking one that's
// known to be exhausted opens this modal instead of sending the request (see
// hooks/useQuotaGate.ts). The backend remains authoritative — if usage was
// stale and the backend rejects anyway, the SAME modal opens from the global
// 'quota:exceeded' bridge in stores/authStore.ts. A modal is a single slot
// (not a stacking list like toasts), so there is no "duplicate" risk even if
// both the proactive check and the reactive bridge fire for one action.
export type QuotaModalKind = 'CASE_LIMIT' | 'PIPELINE_RUN' | 'SOURCE_ADDED' | 'IMAGE_GENERATION' | 'PLAN_NOT_USABLE';

export interface QuotaModalContent {
  kind: QuotaModalKind;
  label: string;
  used?: number;
  limit?: number;
  resetAt?: string;
  // Human message override — used for PLAN_NOT_USABLE (no used/limit to show)
  // and as a fallback whenever exact numbers aren't available.
  message?: string;
}

interface QuotaModalState {
  content: QuotaModalContent | null;
  show: (content: QuotaModalContent) => void;
  close: () => void;
}

export const useQuotaModalStore = create<QuotaModalState>((set) => ({
  content: null,
  show: (content) => set({ content }),
  close: () => set({ content: null }),
}));
