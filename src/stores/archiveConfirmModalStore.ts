import { create } from 'zustand';

// Generic confirm-archive step, reused from two entry paths: the "at active
// limit, archive to continue" flow (ActiveCaseLimitModal's primary button) and
// the Case Detail page's own standalone "Archive this case" action. `onArchived`
// is the caller's continuation (e.g. navigate to /cases/new, or nothing if the
// caller just wants to stay on the now-read-only case).
export interface ArchiveConfirmModalContent {
  caseId: string;
  onArchived?: () => void;
}

interface ArchiveConfirmModalState {
  content: ArchiveConfirmModalContent | null;
  show: (content: ArchiveConfirmModalContent) => void;
  close: () => void;
}

export const useArchiveConfirmModalStore = create<ArchiveConfirmModalState>((set) => ({
  content: null,
  show: (content) => set({ content }),
  close: () => set({ content: null }),
}));
