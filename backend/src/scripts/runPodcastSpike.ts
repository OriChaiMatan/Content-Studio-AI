/**
 * LumAI Podcast Engine — Phase 1 AI Spike runner
 *
 * Usage:
 *   npm run podcast:spike -- --run-id <pipelineRunId>
 *   npm run podcast:spike -- --fixture <fixtureName>
 *   npm run podcast:spike -- --list
 *
 * Examples:
 *   npm run podcast:spike -- --run-id cmr3v3k3w000citt3l1qz148f
 *   npm run podcast:spike -- --fixture english-subscription-trap
 *   npm run podcast:spike -- --list
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { runSpike, runSpikeFromDb } from '../services/podcast-spike/podcastSpikeRunner';
import type { FixtureInput, ResearchPack } from '../services/podcast-spike/podcastSpikeTypes';
import type { ResearchContextV2, FactCheckReport } from '../schemas/aiContractSchemas';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function listFixtures(): void {
  const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
  console.log('\nAvailable fixtures:');
  for (const f of files) console.log(`  --fixture ${f.replace('.json', '')}`);
}

async function listDbRuns(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const runs = await prisma.pipelineRun.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
      where: { researchContext: { not: {} }, factCheckReport: { not: {} } },
      select: {
        id: true,
        status: true,
        outputLanguage: true,
        startedAt: true,
        contentCase: { select: { title: true, language: true, targetAudience: true } },
      },
    });
    console.log('\nAvailable pipeline runs (most recent with research + factCheck):');
    for (const r of runs) {
      const lang = r.outputLanguage ?? r.contentCase?.language ?? '?';
      console.log(`  --run-id ${r.id}  [${lang}] "${r.contentCase?.title}" (${r.status})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function runFromDb(runId: string): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const run = await prisma.pipelineRun.findUniqueOrThrow({
      where: { id: runId },
      select: {
        id: true,
        researchContext: true,
        factCheckReport: true,
        outputLanguage: true,
        contentCase: { select: { title: true, language: true, targetAudience: true } },
      },
    });

    if (!run.researchContext || !run.factCheckReport) {
      throw new Error(`Run ${runId} is missing researchContext or factCheckReport. Check the run status.`);
    }

    const rc = run.researchContext as unknown as ResearchContextV2;
    const fcr = run.factCheckReport as unknown as FactCheckReport;
    const audience = run.contentCase?.targetAudience ?? '';
    const title = run.contentCase?.title ?? runId;

    await runSpikeFromDb(runId, rc, fcr, audience, title);
  } finally {
    await prisma.$disconnect();
  }
}

async function runFromFixture(fixtureName: string): Promise<void> {
  const filePath = path.join(FIXTURES_DIR, `${fixtureName}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Fixture not found: ${filePath}`);
    listFixtures();
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    label: string;
    language: 'en' | 'he';
    caseTitle: string;
    caseAudience: string;
    pack: ResearchPack;
  };

  const input: FixtureInput = {
    kind: 'fixture',
    label: raw.label,
    language: raw.language,
    caseTitle: raw.caseTitle,
    caseAudience: raw.caseAudience,
    pack: raw.pack,
  };

  await runSpike(input);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.length === 0) {
    await listDbRuns();
    listFixtures();
    return;
  }

  const runIdIdx = args.indexOf('--run-id');
  const fixtureIdx = args.indexOf('--fixture');

  if (runIdIdx !== -1) {
    const runId = args[runIdIdx + 1];
    if (!runId) {
      console.error('--run-id requires a value');
      process.exit(1);
    }
    await runFromDb(runId);
  } else if (fixtureIdx !== -1) {
    const fixtureName = args[fixtureIdx + 1];
    if (!fixtureName) {
      console.error('--fixture requires a name');
      listFixtures();
      process.exit(1);
    }
    await runFromFixture(fixtureName);
  } else {
    console.error('Unknown arguments. Use --run-id, --fixture, or --list');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[podcast-spike] Fatal error:', err);
  process.exit(1);
});
