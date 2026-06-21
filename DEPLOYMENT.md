# Deployment — Content Studio AI (single-origin pilot)

One backend service serves **both** the JSON API (`/api/*`) and the built React SPA
from the **same origin**. This keeps the frontend's relative `/api` calls and the
`httpOnly; sameSite=lax` auth cookie working **without CORS**.

> **Run exactly ONE instance.** The scheduler and stuck-run reaper run in-process;
> multiple replicas would double-fire. Set replicas/min-instances = 1, scaling off.

## Architecture
```
Browser ──HTTPS──► [ Node/Express service ]
                     ├─ /api/*        → API (auth, cases, pipeline, library, WhatsApp webhook)
                     └─ everything else → built SPA (backend/public) + index.html SPA fallback
                                   │
                                   └──► Managed PostgreSQL (DATABASE_URL)
```
- Static serving is **production-only** (`NODE_ENV=production`). In dev, Vite serves
  the SPA and proxies `/api` — local dev is unchanged.
- Anthropic is the only outbound dependency; **no Redis / S3 / worker** is used.

## Build & run
- Frontend build (root): `npm ci && npm run build` → `dist/`
- Backend build: `cd backend && npm ci && npx prisma generate && npm run build` → `backend/dist/`
- Migrations (prod): `cd backend && npm run db:deploy`  (= `prisma migrate deploy`, **not** `migrate dev`)
- Start: `cd backend && npm start`  (= `node dist/server.js`)

The included **Dockerfile** does all of the above and, on start, runs
`prisma migrate deploy` then launches the server. The built SPA is copied into
`backend/public`, which Express serves automatically.

## Deploy steps
1. **Provision managed Postgres**; copy `DATABASE_URL`.
2. **Set env** from `backend/.env.production.example` in the host's secret store —
   at minimum: `NODE_ENV=production`, `JWT_SECRET` (`openssl rand -hex 32`),
   `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `SOURCE_ANALYSIS_ENABLED` /
   `RESEARCH_SYNTHESIS_ENABLED` / `CONTENT_GENERATION_ENABLED` = `true`
   (they default to **false → mock**). Set `CORS_ORIGIN` and `APP_BASE_URL` to the
   public URL.
3. **Deploy the Docker image** (Railway/Render: point at this repo's Dockerfile).
   Health check path: **`/api/health`** (200 + DB status). Ensure the platform
   allows **16 MB** request bodies (PDF base64 uploads).
4. **Migrations** run automatically via the container `CMD`; or run `db:deploy` as a
   release step.
5. **WhatsApp (optional, last):** register the webhook at
   `https://<domain>/api/integrations/whatsapp` with `WHATSAPP_VERIFY_TOKEN`. The
   GET handshake works while `WHATSAPP_ENABLED=false`; flip it to `true` + add
   credentials to enable outbound replies.

## Smoke test
`/api/health` → register/login → create case → add source (incl. a social URL) →
run pipeline (confirm **not** mock) → review → approve → library. Mobile pass at ~375px.

## Safety notes
- `NODE_ENV=production` is required for **secure cookies** and is enforced for
  **JWT_SECRET** (server refuses to boot without one).
- Real env files are git-ignored; only `*.example` templates are tracked.
- Keep **one instance** (scheduler/reaper are in-process).
