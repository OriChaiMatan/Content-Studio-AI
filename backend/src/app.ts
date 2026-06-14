import 'dotenv/config';
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
