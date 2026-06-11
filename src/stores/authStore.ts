import { create } from 'zustand';
import { api } from '../lib/api';
import { useSettingsStore } from './settingsStore';

// Phase 12 — authenticated user shape returned by the backend (/api/auth/*).
// Mirrors authService.serializeUser. NEVER contains a password.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  language: 'en' | 'he';
  notifications: {
    generationComplete: boolean;
    factCheckConflict: boolean;
    draftReady: boolean;
  };
  createdAt: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// Mirror the authenticated user into the existing settingsStore so the Sidebar and
// Settings page show the real account without rewiring their consumers (no redesign).
function syncSettingsUser(user: AuthUser) {
  useSettingsStore.getState().updateUser({
    id: user.id, name: user.name, email: user.email, role: user.role,
    avatarUrl: user.avatarUrl, language: user.language, notifications: user.notifications,
  });
}

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  loadMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Called when a protected request returns 401 (cookie expired/invalid).
  handleUnauthorized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  // Boot hydration from the httpOnly cookie. /auth/me ALWAYS returns 200 with
  // { authenticated, user } — no 401 on a logged-out boot.
  loadMe: async () => {
    try {
      const { authenticated, user } = await api.get<{ authenticated: boolean; user: AuthUser | null }>('/auth/me');
      if (authenticated && user) {
        syncSettingsUser(user);
        set({ user, status: 'authenticated' });
      } else {
        set({ user: null, status: 'unauthenticated' });
      }
    } catch {
      // Network/server error (not an auth signal) — treat as logged out for the boot gate.
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (email, password) => {
    const { user } = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
    syncSettingsUser(user);
    set({ user, status: 'authenticated' });
  },

  register: async (name, email, password) => {
    const { user } = await api.post<{ user: AuthUser }>('/auth/register', { name, email, password });
    syncSettingsUser(user);
    set({ user, status: 'authenticated' });
  },

  logout: async () => {
    try { await api.post('/auth/logout', {}); } catch { /* idempotent */ }
    set({ user: null, status: 'unauthenticated' });
  },

  handleUnauthorized: () => set({ user: null, status: 'unauthenticated' }),
}));

// Bridge the global 401 signal from the api layer into the store.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().handleUnauthorized();
  });
}
