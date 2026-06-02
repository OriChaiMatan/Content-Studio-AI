import { create } from 'zustand';
import type { LibraryItem, Platform, OutputStatus } from '../types';
import { mockLibraryItems } from '../data/mockLibraryItems';

interface LibraryFilters {
  caseId: string;
  platform: Platform | 'all';
  status: OutputStatus | 'all';
  query: string;
}

interface LibraryState {
  items: LibraryItem[];
  filters: LibraryFilters;
  viewMode: 'grid' | 'list';

  setFilter: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  addItem: (item: LibraryItem) => void;
  filteredItems: () => LibraryItem[];
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  items: mockLibraryItems,
  filters: { caseId: 'all', platform: 'all', status: 'all', query: '' },
  viewMode: 'grid',

  setFilter: (key, value) =>
    set(state => ({ filters: { ...state.filters, [key]: value } })),

  setViewMode: (mode) => set({ viewMode: mode }),

  addItem: (item) =>
    set(state => {
      // Prevent duplicates — update existing entry if outputId already exists
      const exists = state.items.some(i => i.outputId === item.outputId);
      if (exists) {
        return { items: state.items.map(i => i.outputId === item.outputId ? item : i) };
      }
      return { items: [item, ...state.items] };
    }),

  filteredItems: () => {
    const { items, filters } = get();
    return items.filter(item => {
      if (filters.caseId !== 'all' && item.contentCaseId !== filters.caseId) return false;
      if (filters.platform !== 'all' && item.platform !== filters.platform) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },
}));
