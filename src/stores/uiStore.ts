import { create } from 'zustand';

// Global UI chrome state. Currently just the mobile navigation drawer, which is
// shared across subtrees: the hamburger lives in TopBar (rendered per page) while
// the drawer itself is the Sidebar (rendered by AppLayout) — so the open/close
// state can't be local to either.
interface UiState {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

export const useUiStore = create<UiState>(set => ({
  mobileNavOpen: false,
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set(s => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
