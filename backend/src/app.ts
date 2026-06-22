import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { requireAuth } from './api/middleware/auth';
import authRouter     from './api/routes/auth';
import casesRouter    from './api/routes/cases';
import sourcesRouter  from './api/routes/sources';
import pipelineRouter from './api/routes/pipeline';
import outputsRouter  from './api/routes/outputs';
import libraryRouter  from './api/routes/library';
import whatsappRouter from './api/routes/whatsapp';
import telegramRouter from './api/routes/telegram';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} is not allowed`));
      }
    },
    credentials: true,
  }),
);

// ── WhatsApp webhook (PUBLIC) — Phase 13A ─────────────────────────────────────
// Mounted BEFORE the global JSON parser with a path-scoped raw parser so the
// webhook handler sees the unparsed Buffer needed for HMAC signature verification.
// express.raw sets req._body, so the global express.json() below skips this path —
// global parsing for every other route is unchanged. PUBLIC (no requireAuth):
// trust comes from the verify token (GET) and the HMAC signature (POST).
app.use('/api/integrations/whatsapp', express.raw({ type: '*/*', limit: '1mb' }), whatsappRouter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Limit accommodates base64-encoded PDF uploads (Phase 8.5): a 10 MB PDF is
// ~13.5 MB base64, so allow headroom above MAX_FILE_SIZE_BYTES. Decoded PDF size
// is still hard-capped server-side in pdfExtractionService.
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Telegram webhook (PUBLIC) — Phase 2 ───────────────────────────────────────
// Uses the global JSON parser above; trust is the X-Telegram-Bot-Api-Secret-Token
// header verified inside the router (fail closed). No HMAC/raw body needed.
app.use('/api/integrations/telegram', telegramRouter);

// ── Auth routes (PUBLIC) — Phase 12 ───────────────────────────────────────────
// register/login/logout/me. /me self-guards with requireAuth.
app.use('/api/auth', authRouter);

// ── API routes (PROTECTED) ────────────────────────────────────────────────────
// requireAuth sets req.userId; every case/library route is per-user scoped, and
// each :id|:caseId route additionally enforces strict ownership (404 on mismatch).
// Both routers mount at /api/cases. Express routes by segment depth:
//   casesRouter   → /api/cases, /api/cases/:id           (1 segment)
//   sourcesRouter → /api/cases/:id/sources, .../sources/:sourceId  (3 segments)
// No conflicts — /:id only matches a single path segment.
app.use('/api/cases', requireAuth, casesRouter);
app.use('/api/cases', requireAuth, sourcesRouter);
// pipeline routes: /:id/pipeline, /:id/pipeline/start, /:id/pipeline/advance
app.use('/api/cases', requireAuth, pipelineRouter);
// output routes: /:caseId/outputs/:outputId, .../status, .../regenerate
app.use('/api/cases', requireAuth, outputsRouter);
// library: grouped-by-run view of approved outputs (per-user)
app.use('/api/library', requireAuth, libraryRouter);

// ── Health check ──────────────────────────────────────────────────────────────
// Returns 200 when the server is up.
// Includes a non-blocking database ping: 'connected' | 'unreachable'.
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus: 'connected' | 'unreachable' = 'unreachable';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    // Database is down but the server itself is healthy — return 200 so the
    // frontend can still distinguish "server up, DB down" from "server down".
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// ── Static frontend (single-origin) — PRODUCTION ONLY ─────────────────────────
// Serve the built SPA from the SAME origin as the API so the frontend's relative
// /api calls and the sameSite=lax auth cookie work without CORS. Skipped in dev:
// Vite serves the frontend and proxies /api, so nothing here affects local dev.
// Registered AFTER all /api routes (so the API always wins) and BEFORE the 404.
if (process.env.NODE_ENV === 'production') {
  // Candidate locations for the `vite build` output (dist/):
  //   ../public  → Docker image copies the built SPA into backend/public
  //   ../../dist → monorepo: root-level `npm run build` output
  const candidates = [
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../dist'),
  ];
  const frontendDir = candidates.find(dir => fs.existsSync(path.join(dir, 'index.html')));

  if (frontendDir) {
    const indexHtml = path.join(frontendDir, 'index.html');

    // 1. Hashed, immutable build assets (/assets/*). Served as files with the
    //    correct MIME type. A miss is a GENUINE 404 — never the SPA shell (serving
    //    index.html here would make the browser refuse the CSS/JS on MIME grounds)
    //    and never the JSON error path. Scoped to /assets so navigation is unaffected.
    app.use('/assets', express.static(path.join(frontendDir, 'assets'), {
      index: false,
      immutable: true,
      maxAge: '1y',
    }));
    app.use('/assets', (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Asset not found' });
    });

    // 2. Other root static files (favicon.ico, favicon.svg, icons.svg, …).
    app.use(express.static(frontendDir, { index: false }));

    // 3. SPA fallback — index.html for NAVIGATION GETs only (never /api, never
    //    /assets, never non-GET). The sendFile error callback prevents a missing
    //    shell from throwing into the 500 error handler.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
        return next();
      }
      res.sendFile(indexHtml, err => { if (err) next(err); });
    });

    console.log(`[static] serving frontend from ${frontendDir}`);
  } else {
    console.warn('[static] NODE_ENV=production but no frontend build found — running API-only');
  }
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
