import 'dotenv/config';
import app from './app';
import { prisma } from './lib/prisma';
import { contentGenerationConfig } from './lib/anthropic';
import { schedulerService } from './services/schedulerService';
import { pipelineRunReaperService } from './services/pipelineRunReaperService';

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
    apiKeyPresent: (process.env.ANTHROPIC_API_KEY ?? '').length > 0,
    model: contentGenerationConfig.model,
  }));

  // Phase 14C — start the in-process scheduler (no-op unless SCHEDULER_ENABLED=true).
  // Guarded so a scheduler error can never crash server startup.
  try {
    schedulerService.start();
  } catch (err) {
    console.error('[scheduler] failed to start', err instanceof Error ? err.message : err);
  }

  // Phase 14D — start the always-on stuck-run reaper (independent of the scheduler;
  // no-op unless REAPER_ENABLED!=false). Guarded so it can never crash startup.
  try {
    pipelineRunReaperService.start();
  } catch (err) {
    console.error('[reaper] failed to start', err instanceof Error ? err.message : err);
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  schedulerService.stop();
  pipelineRunReaperService.stop();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected. Bye.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
