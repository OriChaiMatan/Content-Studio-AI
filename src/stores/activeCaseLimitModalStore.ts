import { create } from 'zustand';

// Shown instead of the generic QuotaLimitModal specifically when the reason
// for being blocked is "at active-case limit" (see hooks/useQuotaGate.ts and
// the Content Case Lifecycle plan) — it needs concrete info about the user's
// current active case so the archive action feels informed, not blind.
export interface CaseLimitInfo {
  caseId: string;
  title: string;
  updatedAt: string;       // ISO 8601
  sourceCount: number;
  pipelineRunCount: number;
  outputCount: number;
}

export interface ActiveCaseLimitModalContent {
  // 'create' — blocked while creating a new case (Sidebar/Dashboard/Cases page/
  // wizard entry points). 'reactivate' — blocked while reactivating an archived
  // case (Case Detail's Reactivate button) — shows BOTH the currently active
  // case and the archived case the user is trying to bring back.
  mode: 'create' | 'reactivate';
  activeCase: CaseLimitInfo;
  targetCase?: CaseLimitInfo; // set only when mode === 'reactivate'
}

interface ActiveCaseLimitModalState {
  content: ActiveCaseLimitModalContent | null;
  show: (content: ActiveCaseLimitModalContent) => void;
  close: () => void;
}

export const useActiveCaseLimitModalStore = create<ActiveCaseLimitModalState>((set) => ({
  content: null,
  show: (content) => set({ content }),
  close: () => set({ content: null }),
}));
