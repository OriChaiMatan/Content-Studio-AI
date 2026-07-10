import { create } from 'zustand';

// Single shared "LumAI Pro is coming soon" modal — there is no purchasable Pro
// plan yet, so every Upgrade/Waitlist CTA in the app (authenticated app AND
// the public marketing site) opens this SAME modal rather than each having
// its own copy or its own mailto link. Content is static, so the store only
// needs an open/closed flag.
interface ComingSoonModalState {
  open: boolean;
  show: () => void;
  close: () => void;
}

export const useComingSoonModalStore = create<ComingSoonModalState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
