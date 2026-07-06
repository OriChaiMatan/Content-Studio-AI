import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  Episode, EpisodeTelemetry, ResearchPack, StageTelemetry, SpikeInput,
} from './podcastSpikeTypes';
import { buildResearchPack } from './researchPackService';
import { buildBlueprint } from './podcastBlueprintService';
import { generateSections } from './podcastScriptService';
import { runCritic } from './podcastCriticService';
import { buildPackage } from './podcastPackageService';

// Approximate USD cost for claude-sonnet-4-6 (July 2026).
// These are estimates; actual billed cost may vary.
const COST_PER_1M_INPUT = 3.0;
const COST_PER_1M_OUTPUT = 15.0;
const COST_PER_1M_CACHE_READ = 0.30;
const COST_PER_1M_CACHE_WRITE = 3.75;

function computeCost(stages: StageTelemetry[]): number {
  let cost = 0;
  for (const s of stages) {
    cost += (s.inputTokens / 1_000_000) * COST_PER_1M_INPUT;
    cost += (s.outputTokens / 1_000_000) * COST_PER_1M_OUTPUT;
    cost += (s.cacheReadInputTokens / 1_000_000) * COST_PER_1M_CACHE_READ;
    cost += (s.cacheCreationInputTokens / 1_000_000) * COST_PER_1M_CACHE_WRITE;
  }
  return Math.round(cost * 10000) / 10000;
}

function aggregateTelemetry(stages: StageTelemetry[], totalElapsedMs: number): EpisodeTelemetry {
  const totals = stages.reduce(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.inputTokens,
      outputTokens: acc.outputTokens + s.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + s.cacheReadInputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + s.cacheCreationInputTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  );
  return {
    totalElapsedMs,
    totalInputTokens: totals.inputTokens,
    totalOutputTokens: totals.outputTokens,
    totalCacheReadTokens: totals.cacheReadTokens,
    totalCacheCreationTokens: totals.cacheCreationTokens,
    callCount: stages.length,
    approximateCostUsd: computeCost(stages),
    stages,
  };
}

function renderMarkdown(episode: Episode): string {
  const lang = episode.language === 'he' ? 'Hebrew' : 'English';
  const t = episode.telemetry;

  const lines: string[] = [
    `# ${episode.title}`,
    '',
    `_${episode.subtitle}_`,
    '',
    `**${episode.estimatedDurationMin} min · ${episode.wordCount} words · ${lang} · ${episode.researchDensity} density**`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    episode.executiveSummary,
    '',
    '---',
    '',
    '## Key Takeaways',
    '',
    ...episode.keyTakeaways.map(t => `- ${t}`),
    '',
    '---',
    '',
    '## Episode Outline',
    '',
    ...episode.outline.map((o, i) => `${i + 1}. **${o.name}** (word ${o.wordOffset})`),
    '',
    '---',
    '',
    '## Spoken Episode',
    '',
  ];

  for (const section of episode.sections) {
    lines.push(`### ${section.name}`);
    lines.push('');
    lines.push(section.narration);
    lines.push('');
    lines.push(`_${section.wordCount} words_`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Research Notes');
  lines.push('');
  lines.push('_Creator-facing — not part of the spoken episode._');
  lines.push('');

  const rn = episode.researchNotes ?? { verifiedFacts: [], primarySources: [], importantEntities: [], openQuestions: [], lowerConfidenceClaims: [] };

  if (rn.verifiedFacts.length > 0) {
    lines.push('**Verified Facts**');
    lines.push('');
    for (const f of rn.verifiedFacts) {
      lines.push(`- ${f.fact}${f.source ? ` _(${f.source})_` : ''}`);
    }
    lines.push('');
  }

  if (rn.primarySources.length > 0) {
    lines.push('**Primary Sources**');
    lines.push('');
    for (const s of rn.primarySources) lines.push(`- ${s}`);
    lines.push('');
  }

  if (rn.importantEntities.length > 0) {
    lines.push('**Important Entities**');
    lines.push('');
    for (const e of rn.importantEntities) lines.push(`- ${e}`);
    lines.push('');
  }

  if (rn.openQuestions.length > 0) {
    lines.push('**Open Questions**');
    lines.push('');
    for (const q of rn.openQuestions) lines.push(`- ${q}`);
    lines.push('');
  }

  if (rn.lowerConfidenceClaims.length > 0) {
    lines.push('**Lower Confidence Claims**');
    lines.push('');
    for (const c of rn.lowerConfidenceClaims) lines.push(`- ${c}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Critic Report');
  lines.push('');

  const cr = episode.critique;

  const statusBadge: Record<string, string> = {
    blocked: '🚫 BLOCKED — factual integrity failure',
    needs_review: '⚠️ NEEDS REVIEW',
    pass: '✅ PASS',
  };
  lines.push(`**Quality Status**: ${statusBadge[cr.qualityStatus] ?? cr.qualityStatus}`);
  lines.push('');

  const dims: Array<[string, keyof typeof cr]> = [
    ['Thesis Clarity', 'thesisClarity'],
    ['Opening Strength', 'openingStrength'],
    ['Factual Integrity', 'factualIntegrity'],
    ['Spoken Naturalness', 'spokenNaturalness'],
    ['Narrative Coherence', 'narrativeCoherence'],
    ['Retell Test Readiness', 'retellTestReadiness'],
  ];

  lines.push('| Dimension | Score | Findings |');
  lines.push('|---|---|---|');
  for (const [label, key] of dims) {
    const dim = cr[key] as { score: number; findings: string };
    lines.push(`| ${label} | ${dim.score}/10 | ${dim.findings} |`);
  }
  lines.push('');
  lines.push(`**Overall Score**: ${cr.overallScore}/10 · **Verdict**: ${cr.verdict}`);
  lines.push('');

  if (cr.numericLintFindings && cr.numericLintFindings.length > 0) {
    lines.push('**Numeric Audit**');
    lines.push('');
    for (const finding of cr.numericLintFindings) lines.push(`- ${finding}`);
    lines.push('');
  }

  if (cr.topIssues.length > 0) {
    lines.push('**Top Issues to Fix**');
    lines.push('');
    for (const issue of cr.topIssues) lines.push(`- ${issue}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Generation Metadata');
  lines.push('');
  lines.push(`- Generated: ${episode.generatedAt}`);
  lines.push(`- Language: ${lang}`);
  if (episode.runId) lines.push(`- Pipeline Run ID: ${episode.runId}`);
  if (episode.caseId) lines.push(`- Case ID: ${episode.caseId}`);
  lines.push(`- Spike Episode ID: ${episode.id}`);
  lines.push(`- AI Calls: ${t.callCount}`);
  lines.push(`- Tokens: ${t.totalInputTokens.toLocaleString()} in / ${t.totalOutputTokens.toLocaleString()} out`);
  lines.push(`- Cache: ${t.totalCacheReadTokens.toLocaleString()} read / ${t.totalCacheCreationTokens.toLocaleString()} written`);
  lines.push(`- Estimated Cost: $${t.approximateCostUsd.toFixed(4)}`);
  lines.push(`- Total Time: ${(t.totalElapsedMs / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('**Per-stage breakdown:**');
  lines.push('');
  lines.push('| Stage | ms | Input | Output | Cache Hit |');
  lines.push('|---|---|---|---|---|');
  for (const s of t.stages) {
    lines.push(`| ${s.stage} | ${s.elapsedMs} | ${s.inputTokens} | ${s.outputTokens} | ${s.cacheReadInputTokens} |`);
  }

  return lines.join('\n');
}

function getOutputDir(): string {
  return path.resolve(process.cwd(), 'var', 'podcast-spike');
}

function saveEpisode(episode: Episode, label: string): string {
  const outDir = getOutputDir();
  fs.mkdirSync(outDir, { recursive: true });

  const slug = label.replace(/[^a-zA-Z0-9א-ת]/g, '-').replace(/-+/g, '-').slice(0, 40);
  const ts = new Date().toISOString().slice(0, 16).replace(':', '-');
  const episodeDir = path.join(outDir, `${ts}-${slug}-${episode.language}`);
  fs.mkdirSync(episodeDir, { recursive: true });

  const jsonPath = path.join(episodeDir, 'episode.json');
  const mdPath = path.join(episodeDir, 'episode.md');

  fs.writeFileSync(jsonPath, JSON.stringify(episode, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, renderMarkdown(episode), 'utf-8');

  console.log(`\n  ✓ JSON: ${jsonPath}`);
  console.log(`  ✓ MD:   ${mdPath}`);

  return episodeDir;
}

export async function runSpike(input: SpikeInput): Promise<Episode> {
  const startMs = Date.now();
  const stageTelemetry: StageTelemetry[] = [];

  let pack: ResearchPack;
  let runId: string | undefined;
  let caseId: string | undefined;
  let label: string;

  if (input.kind === 'fixture') {
    console.log(`\n[podcast-spike] Fixture: ${input.label}`);
    pack = input.pack;
    label = input.label;
  } else {
    console.log(`\n[podcast-spike] DB run: ${input.runId}`);
    // Fetch from DB — done in the CLI runner; the runner passes a db-run with
    // pre-fetched artifacts attached.
    throw new Error('DB run inputs should be pre-fetched by the CLI runner');
  }

  console.log(`  Thesis: ${pack.thesis.slice(0, 80)}...`);
  console.log(`  Language: ${pack.language}  Density: ${pack.researchDensity}`);

  // Stage 2: Blueprint
  console.log('\n[Stage 2] Blueprint...');
  const blueprint = await buildBlueprint(pack, stageTelemetry);
  console.log(`  Title: "${blueprint.title}"`);
  console.log(`  Duration: ~${blueprint.durationEstimateMin} min, ${blueprint.estimatedWordCount} words`);
  console.log(`  Sections: ${blueprint.sections.map(s => s.name).join(' → ')}`);

  // Stage 3: Sections
  console.log('\n[Stage 3] Generating sections...');
  const sections = await generateSections(pack, blueprint, stageTelemetry);
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  console.log(`  Done: ${sections.length} sections, ${totalWords} total words`);

  // Stage 4: Critic
  console.log('\n[Stage 4] Critic...');
  const critique = await runCritic(pack, blueprint, sections, stageTelemetry);
  console.log(`  Verdict: ${critique.verdict}  Status: ${critique.qualityStatus}  Overall: ${critique.overallScore}/10`);
  if (critique.numericLintFindings?.some(f => f.startsWith('UNSUPPORTED'))) {
    console.log('  !! Unsupported numeric claims detected — see numericLintFindings');
  }

  // Stage 5: Package
  console.log('\n[Stage 5] Package...');
  const pkg = await buildPackage(pack, blueprint, sections, stageTelemetry);

  // Compute duration from actual word count
  const wpm = pack.language === 'he' ? 130 : 150;
  const durationMin = Math.round(totalWords / wpm);

  const episode: Episode = {
    id: crypto.randomUUID(),
    runId,
    caseId,
    language: pack.language,
    generatedAt: new Date().toISOString(),
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    executiveSummary: pkg.executiveSummary,
    keyTakeaways: pkg.keyTakeaways,
    outline: pkg.outline,
    sections,
    researchNotes: pack.researchNotes,
    critique,
    estimatedDurationMin: durationMin,
    wordCount: totalWords,
    researchDensity: pack.researchDensity,
    telemetry: aggregateTelemetry(stageTelemetry, Date.now() - startMs),
  };

  saveEpisode(episode, label);

  const t = episode.telemetry;
  console.log(`\n[podcast-spike] Complete.`);
  console.log(`  ${t.callCount} AI calls · ${t.totalInputTokens.toLocaleString()} in / ${t.totalOutputTokens.toLocaleString()} out tokens`);
  console.log(`  Cache: ${t.totalCacheReadTokens.toLocaleString()} read · $${t.approximateCostUsd.toFixed(4)} est. · ${(t.totalElapsedMs / 1000).toFixed(0)}s`);

  return episode;
}

// Overload for DB-sourced runs — pre-fetches pack from researchContext+factCheckReport
// then delegates to the fixture path.
export async function runSpikeFromDb(
  runId: string,
  rc: import('../../schemas/aiContractSchemas.js').ResearchContextV2,
  fcr: import('../../schemas/aiContractSchemas.js').FactCheckReport,
  caseAudience: string,
  caseTitle: string,
): Promise<Episode> {
  const startMs = Date.now();
  const stageTelemetry: StageTelemetry[] = [];

  // Stage 1: Research Pack
  console.log(`\n[podcast-spike] DB run: ${runId}`);
  console.log('[Stage 1] Building Research Pack from pipeline artifacts...');
  const pack = await buildResearchPack(rc, fcr, caseAudience, stageTelemetry);
  console.log(`  Thesis: ${pack.thesis.slice(0, 80)}...`);
  console.log(`  Density: ${pack.researchDensity}  Recommendation: ${pack.podcastRecommendation.verdict}`);

  // Stage 2: Blueprint
  console.log('\n[Stage 2] Blueprint...');
  const blueprint = await buildBlueprint(pack, stageTelemetry);
  console.log(`  Title: "${blueprint.title}"`);
  console.log(`  Duration: ~${blueprint.durationEstimateMin} min, ${blueprint.estimatedWordCount} words`);
  console.log(`  Sections: ${blueprint.sections.map(s => s.name).join(' → ')}`);

  // Stage 3: Sections
  console.log('\n[Stage 3] Generating sections...');
  const sections = await generateSections(pack, blueprint, stageTelemetry);
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  console.log(`  Done: ${sections.length} sections, ${totalWords} total words`);

  // Stage 4: Critic
  console.log('\n[Stage 4] Critic...');
  const critique = await runCritic(pack, blueprint, sections, stageTelemetry);
  console.log(`  Verdict: ${critique.verdict}  Status: ${critique.qualityStatus}  Overall: ${critique.overallScore}/10`);
  if (critique.numericLintFindings?.some(f => f.startsWith('UNSUPPORTED'))) {
    console.log('  !! Unsupported numeric claims detected — see numericLintFindings');
  }

  // Stage 5: Package
  console.log('\n[Stage 5] Package...');
  const pkg = await buildPackage(pack, blueprint, sections, stageTelemetry);

  const wpm = pack.language === 'he' ? 130 : 150;
  const durationMin = Math.round(totalWords / wpm);

  const episode: Episode = {
    id: crypto.randomUUID(),
    runId,
    language: pack.language,
    generatedAt: new Date().toISOString(),
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    executiveSummary: pkg.executiveSummary,
    keyTakeaways: pkg.keyTakeaways,
    outline: pkg.outline,
    sections,
    researchNotes: pack.researchNotes,
    critique,
    estimatedDurationMin: durationMin,
    wordCount: totalWords,
    researchDensity: pack.researchDensity,
    telemetry: aggregateTelemetry(stageTelemetry, Date.now() - startMs),
  };

  saveEpisode(episode, caseTitle || runId);

  const t = episode.telemetry;
  console.log(`\n[podcast-spike] Complete.`);
  console.log(`  ${t.callCount} AI calls · ${t.totalInputTokens.toLocaleString()} in / ${t.totalOutputTokens.toLocaleString()} out tokens`);
  console.log(`  Cache: ${t.totalCacheReadTokens.toLocaleString()} read · $${t.approximateCostUsd.toFixed(4)} est. · ${(t.totalElapsedMs / 1000).toFixed(0)}s`);

  return episode;
}
