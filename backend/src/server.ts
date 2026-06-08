import 'dotenv/config';
import app from './app';
import { prisma } from './lib/prisma';
import { contentGenerationConfig } from './lib/anthropic';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`Content Studio AI backend running on http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log(`  Environment: ${process.env.NODE_ENV ?? 'development'}`);
  // Minimal startup diagnostic for Content Generator activation (Phase 9).
  console.log('[startup] content-gen:', JSON.stringify({
    cwd: process.cwd(),
    CONTENT_GENERATION_ENABLED: process.env.CONTENT_GENERATION_ENABLED ?? '(unset)',
    enabledResolved: contentGenerationConfig.enabled,
    podcastEnabled: contentGenerationConfig.podcastEnabled,
    apiKeyPresent: (process.env.ANTHROPIC_API_KEY ?? '').length > 0,
    model: contentGenerationConfig.model,
  }));
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected. Bye.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
