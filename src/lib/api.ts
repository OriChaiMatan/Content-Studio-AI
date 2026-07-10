// Thin fetch wrapper — all paths are relative so the Vite /api proxy
// handles routing in development and a reverse proxy handles it in production.

const BASE = '/api';

// Thrown for HTTP-level errors (4xx / 5xx). Status is preserved so callers
// can distinguish "server error" from "network unreachable" (TypeError).
// Uses explicit field assignment — parameter properties are banned by erasableSyntaxOnly.
// code/metric/resetAt/limit mirror the backend's quota-error shape (see
// backend/src/lib/quotaErrors.ts's sendQuotaError) — undefined for non-quota errors.
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly metric?: string;
  readonly resetAt?: string;
  readonly limit?: number;

  constructor(status: number, message: string, extra?: { code?: string; metric?: string; resetAt?: string; limit?: number }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extra?.code;
    this.metric = extra?.metric;
    this.resetAt = extra?.resetAt;
    this.limit = extra?.limit;
  }
}

// Codes the backend attaches to a 40x quota-gate rejection (see
// backend/src/lib/quotaErrors.ts). A recognized code triggers a global
// 'quota:exceeded' event (mirroring the existing 401 → 'auth:unauthorized'
// bridge below) so a single listener (authStore.ts) can open the quota modal
// consistently regardless of which call site triggered it. Shared so both the
// dispatch below and any call site's own catch block use the exact same list.
export const QUOTA_ERROR_CODES = new Set([
  'quota_exceeded', 'case_limit_reached', 'plan_not_usable', 'scheduling_not_allowed',
]);
export function isQuotaApiError(err: unknown): err is ApiError {
  return err instanceof ApiError && typeof err.code === 'string' && QUOTA_ERROR_CODES.has(err.code);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // TypeError is thrown here if the backend is unreachable (ECONNREFUSED, etc.)
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    // Phase 12 — send the httpOnly auth cookie with every request.
    credentials: 'include',
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    // Phase 12 — a 401 on a protected call means the session is gone/expired.
    // Notify the app (authStore listens) so it can route back to /login. We skip
    // /auth/* endpoints, where a 401 is an expected, locally-handled outcome.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    const isQuotaCode = typeof json?.code === 'string' && QUOTA_ERROR_CODES.has(json.code);
    if (isQuotaCode) {
      window.dispatchEvent(new CustomEvent('quota:exceeded', { detail: json }));
    }
    const message = typeof json?.error === 'string'
      ? json.error
      : `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, isQuotaCode ? {
      code: json.code, metric: json.metric, resetAt: json.resetAt, limit: json.limit,
    } : undefined);
  }

  return json as T;
}

export const api = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                   => request<void>(path, { method: 'DELETE' }),
};
