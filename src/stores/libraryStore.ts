import { create } from 'zustand';
import type { LibraryRunGroup } from '../types';
import { api } from '../lib/api';

interface LibraryState {
  runs: LibraryRunGroup[];
  loading: boolean;
  query: string;

  fetchLibrary: () => Promise<void>;
  setQuery: (q: string) => void;
  filteredRuns: () => LibraryRunGroup[];
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  runs:    [],
  loading: false,
  query:   '',

  fetchLibrary: async () => {
    set({ loading: true });
    try {
      const { runs } = await api.get<{ runs: LibraryRunGroup[] }>('/library');
      set({ runs, loading: false });
    } catch {
      // Silently fail — keep whatever was already loaded
      set({ loading: false });
    }
  },

  setQuery: (query) => set({ query }),

  filteredRuns: () => {
    const { runs, query } = get();
    if (!query) return runs;
    const q = query.toLowerCase();
    return runs.filter(r =>
      r.caseTitle.toLowerCase().includes(q) ||
      r.items.some(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)),
    );
  },
}));

// Load library data on module import
queueMicrotask(() => {
  useLibraryStore.getState().fetchLibrary();
});
