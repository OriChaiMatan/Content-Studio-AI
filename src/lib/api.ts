// Thin fetch wrapper — all paths are relative so the Vite /api proxy
// handles routing in development and a reverse proxy handles it in production.

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    throw new Error(
      typeof json?.error === 'string' ? json.error : `Request failed: ${res.status}`,
    );
  }

  return json as T;
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)   => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                     => request<void>(path, { method: 'DELETE' }),
};
