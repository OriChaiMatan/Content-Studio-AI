import { create } from 'zustand';
import { api } from '../lib/api';
import { useSettingsStore } from './settingsStore';
import { useUsageStore, METRIC_LABELS, type UsageMetricKey } from './usageStore';
import { useQuotaModalStore, type QuotaModalKind } from './quotaModalStore';

// Phase 12 — authenticated user shape returned by the backend (/api/auth/*).
// Mirrors authService.serializeUser. NEVER contains a password.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  // Roles/Plans/Usage (Phase 1/3) — authorization + entitlement, separate from
  // the cosmetic `role` display title above. See backend systemRole/plan/planStatus.
  systemRole: 'USER' | 'MASTER';
  plan: 'FREE' | 'PRO';
  planStatus: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'SUSPENDED' | 'TRIAL';
  usage: {
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextResetAt: string;
  };
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
    // Phase 13G — WhatsApp-specific notification opt-out (read-only display).
    optOut: boolean;
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
  // Password recovery. Neither changes auth status; both just call the API.
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
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
        void useUsageStore.getState().fetch();
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
    void useUsageStore.getState().fetch();
  },

  register: async (name, email, password, whatsappPhone) => {
    const { user, whatsappVerification } = await api.post<{ user: AuthUser; whatsappVerification: WhatsappVerification | null }>(
      '/auth/register', { name, email, password, whatsappPhone },
    );
    syncSettingsUser(user);
    set({ user, status: 'authenticated', whatsappVerification });
    void useUsageStore.getState().fetch();
  },

  logout: async () => {
    try { await api.post('/auth/logout', {}); } catch { /* idempotent */ }
    set({ user: null, status: 'unauthenticated', whatsappVerification: null });
    useUsageStore.getState().clear();
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

  // Password recovery — request a reset link. The backend ALWAYS returns the same
  // generic success (never reveals whether the email exists), so this resolves on 2xx.
  forgotPassword: async (email) => {
    await api.post('/auth/forgot-password', { email });
  },

  // Password recovery — set a new password with a one-time token. Throws ApiError on an
  // invalid/expired/used token (400) so the page can show its error state.
  resetPassword: async (token, password) => {
    await api.post('/auth/reset-password', { token, password });
  },

  handleUnauthorized: () => set({ user: null, status: 'unauthenticated' }),
}));

// Bridge the global 401 signal from the api layer into the store.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().handleUnauthorized();
  });

  // Roles/Plans/Usage — bridge the global quota-rejection signal (see lib/api.ts)
  // into the quota-limit MODAL (not a toast — see quotaModalStore.ts for why a
  // modal has no "duplicate stacking" risk). This is the REACTIVE half: it
  // covers any call site whose usage was stale and got rejected by the backend
  // anyway. The PROACTIVE half (checking known-fresh usage before sending the
  // request at all) lives per-component via hooks/useQuotaGate.ts. Both target
  // the same modal, so a request that hits both paths just shows it once.
  window.addEventListener('quota:exceeded', (e) => {
    const detail = (e as CustomEvent<{ error?: string; code?: string; metric?: string; resetAt?: string; limit?: number }>).detail;
    if (!detail || detail.code === 'scheduling_not_allowed') return; // handled by the wizard's own lock UI
    void (async () => {
      // Refresh so the modal shows the current used/limit, not a stale snapshot.
      await useUsageStore.getState().fetch();
      const summary = useUsageStore.getState().summary;

      if (detail.code === 'plan_not_usable') {
        useQuotaModalStore.getState().show({ kind: 'PLAN_NOT_USABLE', label: 'Account status', message: detail.error });
        return;
      }
      if (detail.code === 'case_limit_reached') {
        useQuotaModalStore.getState().show({
          kind: 'CASE_LIMIT', label: 'Active content cases',
          used: summary?.cases.used ?? detail.limit, limit: summary?.cases.limit ?? detail.limit,
          message: detail.error,
        });
        return;
      }
      if (detail.code === 'quota_exceeded' && detail.metric) {
        const key = detail.metric as UsageMetricKey;
        const m = summary?.metrics[key];
        useQuotaModalStore.getState().show({
          kind: key as QuotaModalKind, label: METRIC_LABELS[key]?.label ?? key,
          used: m?.used ?? detail.limit, limit: m?.limit ?? detail.limit,
          resetAt: detail.resetAt ?? summary?.nextUsageResetAt,
          message: detail.error,
        });
      }
    })();
  });
}
