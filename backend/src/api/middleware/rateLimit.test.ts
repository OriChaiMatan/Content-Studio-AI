import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { makeLimiter } from './rateLimit';

// Spin up a tiny real Express app behind the limiter and drive it over HTTP, so we
// exercise the ACTUAL express-rate-limit middleware (not a mock, not pass-through).
// An injector sets req.userId from an x-test-user header to simulate requireAuth.
async function startApp(limiter: RequestHandler) {
  const app = express();
  const injectUser = (req: Request, _res: Response, next: NextFunction) => {
    const u = req.header('x-test-user');
    if (u) req.userId = u;
    next();
  };
  app.get('/ping', injectUser, limiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}/ping`,
    async close() {
      server.closeAllConnections?.(); // drop keep-alive sockets so close() resolves promptly
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

const LIVE = () => false; // force the limiter ON even under NODE_ENV=test

const get = (url: string, user?: string) =>
  fetch(url, { headers: user ? { 'x-test-user': user } : {} });

test('A. user-scoped limiter blocks after max, with the 429 contract + Retry-After', async () => {
  const { url, close } = await startApp(makeLimiter({ windowMs: 60_000, max: 2, scope: 'user' }, LIVE));
  try {
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-A')).status, 200);
    const r3 = await get(url, 'user-A');
    assert.equal(r3.status, 429);

    const body = await r3.json();
    assert.equal(body.error, 'rate_limit_exceeded');
    assert.equal(body.message, 'Too many requests. Please try again later.');
    assert.equal(typeof body.retryAfter, 'number');
    assert.ok(body.retryAfter >= 0 && body.retryAfter <= 60);
    assert.ok(r3.headers.get('retry-after') !== null); // standard header emitted
  } finally {
    await close();
  }
});

test('B. user-scoped limiter is keyed per userId (one user exhausting does not block another)', async () => {
  const { url, close } = await startApp(makeLimiter({ windowMs: 60_000, max: 2, scope: 'user' }, LIVE));
  try {
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-A')).status, 429); // A is now limited
    assert.equal((await get(url, 'user-B')).status, 200); // B has its own bucket
  } finally {
    await close();
  }
});

test('C. ip-scoped limiter ignores userId (shared bucket across users on one IP)', async () => {
  const { url, close } = await startApp(makeLimiter({ windowMs: 60_000, max: 2, scope: 'ip' }, LIVE));
  try {
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-B')).status, 200);
    assert.equal((await get(url, 'user-C')).status, 429); // same IP → shared limit
  } finally {
    await close();
  }
});

test('D. user-scoped limiter falls back to IP when no userId is present', async () => {
  const { url, close } = await startApp(makeLimiter({ windowMs: 60_000, max: 2, scope: 'user' }, LIVE));
  try {
    assert.equal((await get(url)).status, 200);
    assert.equal((await get(url)).status, 200);
    assert.equal((await get(url)).status, 429); // keyed by IP fallback
  } finally {
    await close();
  }
});

test('E. disabled limiter is pass-through (skipFn → true never limits)', async () => {
  const { url, close } = await startApp(makeLimiter({ windowMs: 60_000, max: 1, scope: 'user' }, () => true));
  try {
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-A')).status, 200);
    assert.equal((await get(url, 'user-A')).status, 200); // past max=1, still allowed
  } finally {
    await close();
  }
});
