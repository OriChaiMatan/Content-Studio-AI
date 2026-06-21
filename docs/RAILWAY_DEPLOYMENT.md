# Railway Production Deployment — Content Studio AI (app.mrtrk.com)

Grounded in this repo's actual setup: single-origin **Dockerfile** at the repo root, in-process scheduler/reaper, and webhook paths under `/api/integrations/...`.

> All secrets below are **placeholders** — set real values in Railway's Variables (secret store). Never commit filled-in values.

## 1. Railway services needed
- **PostgreSQL** — Railway managed database plugin (`New → Database → PostgreSQL`). Exposes `DATABASE_URL`.
- **Backend web service** — built from the **root `Dockerfile`** (`New → GitHub Repo` → this repo). This single service serves **both** the API and the built SPA (same origin), so **no separate frontend service**.
- **No Redis, no worker, no S3** — not used by this app.
- ⚠️ **Replicas = 1** on the backend service (Settings → Replicas). The scheduler + stuck-run reaper run **in-process**; multiple replicas would double-fire. Disable autoscaling.

## 2. Build / deploy settings (backend service)
- **Builder:** Dockerfile (Railway auto-detects the root `Dockerfile`). Root directory = repo root.
- **Start command:** leave empty — the Dockerfile `CMD` runs `prisma migrate deploy && node dist/server.js`.
- **Port:** none to set — the app listens on Railway's injected `PORT` (`process.env.PORT`, default 3001).
- **Health check path:** `/api/health` (returns 200 + DB status). Set in Settings → Health Check.
- **Restart policy:** On failure.
- **Request body size:** confirm Railway's edge allows **16 MB** bodies (PDF base64 uploads).

## 3. Database migration command
- **Automatic:** the container `CMD` runs `npx prisma migrate deploy` on every start, before the server boots — so deploys self-migrate. (Uses `prisma migrate deploy`, **never** `migrate dev`.)
- **Manual (if needed)**, via Railway shell on the backend service:
  ```bash
  cd backend && npx prisma migrate deploy
  ```
- Do **not** run `prisma migrate dev` / `db push` against production.

## 4. Required environment variables (backend service → Variables)
Reference Postgres via Railway's variable reference, not a hardcoded URL.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | enables secure cookies + JWT enforcement + static SPA serving |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference to the Postgres service |
| `JWT_SECRET` | `<REPLACE_WITH_LONG_RANDOM_SECRET>` | **secret**; rotating logs everyone out |
| `CORS_ORIGIN` | `https://app.mrtrk.com` | |
| `APP_BASE_URL` | `https://app.mrtrk.com` | used in review links + bot deep links |
| `ANTHROPIC_API_KEY` | `<REPLACE_WITH_ANTHROPIC_API_KEY>` | **secret** |
| `SOURCE_ANALYSIS_ENABLED` | `true` | defaults false → mock |
| `RESEARCH_SYNTHESIS_ENABLED` | `true` | defaults false → mock |
| `CONTENT_GENERATION_ENABLED` | `true` | defaults false → mock |

Optional/feature: scheduler (`SCHEDULER_ENABLED` default false), reaper (`REAPER_ENABLED` default true), and the channel vars below. `PORT` is injected by Railway — don't set it. (Full optional tunable list lives in `backend/.env.production.example`.)

**Telegram (if enabling):**

| Variable | Value | Notes |
|---|---|---|
| `TELEGRAM_ENABLED` | `true` | |
| `TELEGRAM_BOT_TOKEN` | `<REPLACE_WITH_TELEGRAM_BOT_TOKEN>` | **secret** |
| `TELEGRAM_WEBHOOK_SECRET` | `<REPLACE_WITH_TELEGRAM_WEBHOOK_SECRET>` | **secret**; must match `setWebhook` secret_token |
| `TELEGRAM_BOT_USERNAME` | `<your_bot_username>` | without the `@` |
| `TELEGRAM_API_BASE` | `https://api.telegram.org` | override only for self-hosted Bot API |

**WhatsApp (if enabling):**

| Variable | Value | Notes |
|---|---|---|
| `WHATSAPP_ENABLED` | `true` | |
| `WHATSAPP_VERIFY_TOKEN` | `<REPLACE_WITH_WHATSAPP_VERIFY_TOKEN>` | **secret**; GET handshake token |
| `WHATSAPP_APP_SECRET` | `<REPLACE_WITH_META_APP_SECRET>` | **secret**; inbound HMAC |
| `WHATSAPP_TOKEN` | `<REPLACE_WITH_WHATSAPP_TOKEN>` | **secret**; Graph API bearer |
| `WHATSAPP_PHONE_NUMBER_ID` | `<your_phone_number_id>` | |
| `WHATSAPP_API_VERSION` | `v21.0` | |
| `WHATSAPP_DISPLAY_NUMBER` | `<+CCXXXXXXXXX>` | human-dialable number shown in UI |

## 5. Domain setup for app.mrtrk.com
1. Backend service → Settings → **Networking → Custom Domain** → add `app.mrtrk.com`. Railway returns a CNAME target like `xxxx.up.railway.app`.
2. At your **mrtrk.com DNS** provider, add: **CNAME** `app` → `xxxx.up.railway.app` (proxy / orange-cloud **off** if using Cloudflare, so Railway can issue the cert).
3. Wait for Railway to provision **TLS** (Let's Encrypt) — the domain shows "Active" with a padlock.
4. Confirm `CORS_ORIGIN` and `APP_BASE_URL` = `https://app.mrtrk.com`. Single-origin means SPA + API both live here, so CORS isn't even triggered.

## 6. Telegram webhook update
Run after the domain is live and `TELEGRAM_*` are set:

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://app.mrtrk.com/api/integrations/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d "drop_pending_updates=true"

# verify:
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

- `secret_token` **must** equal `TELEGRAM_WEBHOOK_SECRET` (the route fails closed on mismatch).
- Set the bot's `@username` as `TELEGRAM_BOT_USERNAME` so Settings → Connect Telegram builds a valid `t.me/<bot>?start=…` link.

## 7. WhatsApp webhook update
In **Meta App dashboard → WhatsApp → Configuration → Webhook**:

- **Callback URL:** `https://app.mrtrk.com/api/integrations/whatsapp/webhook`
- **Verify token:** `<WHATSAPP_VERIFY_TOKEN>` → click **Verify and Save** (Meta does a GET handshake; this works even while `WHATSAPP_ENABLED=false`, so you can register first).
- **Subscribe** to the `messages` webhook field.
- Ensure `WHATSAPP_APP_SECRET` = your Meta **App Secret** (used for the inbound `X-Hub-Signature-256` HMAC).
- To actually send replies/notifications, set `WHATSAPP_ENABLED=true` + `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.

## 8. Production smoke test checklist
- `GET https://app.mrtrk.com/api/health` → `200`, `database: "connected"`, `environment: "production"`.
- SPA loads at `https://app.mrtrk.com/` and on a deep link (e.g. `/settings`) — SPA fallback works.
- **Register / login** → refresh keeps you signed in (proves same-origin httpOnly cookie).
- **Create case** → **add source** (an article URL + a social URL → expect graceful failed/partial + manual-paste fallback).
- **Run pipeline** → research → fact-check → generation completes; **confirm real, not mock** (no "Generated with fallback" / "degraded research" badges).
- **Review** → drafts load, scroll, RTL/Hebrew renders correctly, **Copy/Share** work → **Approve** persists → appears in **Library**.
- **Telegram:** Settings → Connect Telegram → open link → `/start` binds (success message) → send a URL to the bot → source added to the active case.
- **WhatsApp:** send a URL from the linked number → source added; failed social link → "send the post text" recovery.
- **Notifications:** trigger a completion → owner receives the "New content for … is ready" message on **every** linked + verified channel (logs show `attempted/succeeded`).
- **Mobile pass** (~375px): login, dashboard, case detail, review, library, Settings.
- **Single instance check:** Railway shows 1 replica; logs show one `[scheduler]` / `[reaper]` startup.
