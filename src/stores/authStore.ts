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
  // Phase 13B — WhatsApp channel status. phoneE164 here is MASKED.
  whatsapp: {
    linked: boolean;
    verified: boolean;
    phoneE164: string | null;
    verifiedAt: string | null;
  };
  createdAt: string;
}

// Phase 13B — owner-only verification payload from register/resend/change. Holds the
// PLAINTEXT code + FULL number for the /verify-whatsapp screen. Lost on reload (not
// persisted): the page offers "resend" to mint a fresh one.
export interface WhatsappVerification {
  phoneE164: string;
  code: string;
  expiresAt: string | null;
  businessNumber: string | null;
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
  // Phase 13B — last verification payload (code + full number) from register/resend/
  // change. Null until issued; null after a reload. Drives the /verify-whatsapp page.
  whatsappVerification: WhatsappVerification | null;
  loadMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, whatsappPhone: string) => Promise<void>;
  logout: () => Promise<void>;
  // Phase 13B — re-issue the code / change the number; both refresh whatsappVerification.
  resendWhatsappCode: () => Promise<void>;
  changeWhatsappNumber: (whatsappPhone: string) => Promise<void>;
  // Called when a protected request returns 401 (cookie expired/invalid).
  handleUnauthorized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  whatsappVerification: null,

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

  register: async (name, email, password, whatsappPhone) => {
    const { user, whatsappVerification } = await api.post<{ user: AuthUser; whatsappVerification: WhatsappVerification | null }>(
      '/auth/register', { name, email, password, whatsappPhone },
    );
    syncSettingsUser(user);
    set({ user, status: 'authenticated', whatsappVerification });
  },

  logout: async () => {
    try { await api.post('/auth/logout', {}); } catch { /* idempotent */ }
    set({ user: null, status: 'unauthenticated', whatsappVerification: null });
  },

  resendWhatsappCode: async () => {
    const { whatsappVerification } = await api.post<{ whatsappVerification: WhatsappVerification }>(
      '/auth/whatsapp/resend', {},
    );
    set({ whatsappVerification });
  },

  changeWhatsappNumber: async (whatsappPhone) => {
    const { whatsappVerification } = await api.patch<{ whatsappVerification: WhatsappVerification }>(
      '/auth/whatsapp/number', { whatsappPhone },
    );
    set({ whatsappVerification });
  },

  handleUnauthorized: () => set({ user: null, status: 'unauthenticated' }),
}));

// Bridge the global 401 signal from the api layer into the store.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().handleUnauthorized();
  });
}
