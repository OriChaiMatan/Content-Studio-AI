import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/prisma';
import casesRouter   from './api/routes/cases';
import sourcesRouter from './api/routes/sources';

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

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API routes ────────────────────────────────────────────────────────────────
// Both routers mount at /api/cases. Express routes by segment depth:
//   casesRouter   → /api/cases, /api/cases/:id           (1 segment)
//   sourcesRouter → /api/cases/:id/sources, .../sources/:sourceId  (3 segments)
// No conflicts — /:id only matches a single path segment.
app.use('/api/cases', casesRouter);
app.use('/api/cases', sourcesRouter);

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
