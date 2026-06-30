# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Single-origin image: the Express backend serves BOTH the JSON API (/api/*) and
# the built React SPA from the same origin. This keeps the frontend's relative
# /api calls and the sameSite=lax auth cookie working without CORS.
#
# Run ONE instance only — the scheduler and stuck-run reaper run in-process, so
# multiple replicas would double-fire.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1 — build the frontend (root Vite app → /app/dist) ──────────────────
FROM node:20-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Stage 2 — build the backend (TypeScript → dist) + generate Prisma client ──
FROM node:20-slim AS backend
WORKDIR /app/backend
# Don't download Playwright browsers in this throwaway build stage — the runtime
# stage installs Chromium (+ its OS deps) into the final image instead.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

# ── Stage 3 — runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
# Visual pipeline (overlayRender.ts) renders HTML→PNG via Playwright/Chromium.
# Install the browser binary into a fixed, root-independent path so the running
# process finds it regardless of HOME/user.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Backend deps (incl. Prisma CLI for `migrate deploy` + generated client),
# compiled output, the Prisma schema/migrations, and the built SPA.
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/prisma ./prisma
COPY --from=backend /app/backend/package.json ./package.json
# Built SPA → served by Express from backend/public (../public relative to dist/).
COPY --from=frontend /app/dist ./public
# Bundled overlay fonts (Heebo — Hebrew+Latin) the renderer loads from assets/fonts.
# Required by overlayRender.ts; the renderer throws without it.
COPY --from=backend /app/backend/assets ./assets
# Install ONLY Chromium + its required OS libraries (not firefox/webkit) into the
# final image. `--with-deps` runs apt-get for the shared libs Chromium needs.
RUN npx playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*
EXPOSE 3001
# Apply pending migrations (deploy, NOT dev) then start the single instance.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
