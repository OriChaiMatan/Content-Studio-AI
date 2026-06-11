// Thin fetch wrapper — all paths are relative so the Vite /api proxy
// handles routing in development and a reverse proxy handles it in production.

const BASE = '/api';

// Thrown for HTTP-level errors (4xx / 5xx). Status is preserved so callers
// can distinguish "server error" from "network unreachable" (TypeError).
// Uses explicit field assignment — parameter properties are banned by erasableSyntaxOnly.
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
    const message = typeof json?.error === 'string'
      ? json.error
      : `Request failed: ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return json as T;
}

export const api = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                   => request<void>(path, { method: 'DELETE' }),
};
