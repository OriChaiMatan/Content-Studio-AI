import type Anthropic from '@anthropic-ai/sdk';
import type {
  ResearchPack, Blueprint, EpisodeSection, CriticReport, StageTelemetry,
} from './podcastSpikeTypes';
import { getSpikeClient, SPIKE_MODEL, extractToolInput, recordTelemetry } from './spikeClient';

// Stage 4: Critic — evaluates the assembled episode against the ResearchPack.
// Phase 1: report-only. No automatic fix loop.

const CRITIC_TOOL_NAME = 'emit_critique';

const CRITIC_TOOL: Anthropic.Tool = {
  name: CRITIC_TOOL_NAME,
  description: 'Emit a structured quality critique of the assembled podcast episode.',
  input_schema: {
    type: 'object' as const,
    required: [
      'thesisClarity', 'openingStrength', 'factualIntegrity',
      'spokenNaturalness', 'narrativeCoherence', 'retellTestReadiness',
      'overallScore', 'verdict', 'qualityStatus', 'numericLintFindings', 'topIssues',
    ],
    properties: {
      thesisClarity: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Is the thesis stated, argued, and landed clearly?',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string' },
        },
      },
      openingStrength: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Does the opening hook immediately without clichés?',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string' },
        },
      },
      factualIntegrity: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Do all specific claims trace back to the Research Pack? Any hallucinations or invented numbers?',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string', description: 'List any claims not found in the Research Pack, especially invented numbers.' },
        },
      },
      spokenNaturalness: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Does it sound like a senior analyst speaking, not text being read? Any written-language artifacts, AI filler, corporate buzzwords?',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string' },
        },
      },
      narrativeCoherence: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Does it flow as one coherent argument? Check three things: (1) stitched-together paragraph feel, (2) verbatim paragraph repetition — any sentence or paragraph that appears twice verbatim scores below 6, (3) conceptual repetition where the same point is made more than once in different words.',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string' },
        },
      },
      retellTestReadiness: {
        type: 'object',
        required: ['score', 'findings'],
        description: 'Could a listener explain the thesis, mechanism, one fact, and one implication 48 hours later?',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          findings: { type: 'string' },
        },
      },
      overallScore: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Weighted average of the six dimensions.',
      },
      verdict: {
        type: 'string',
        enum: ['PASS', 'NEEDS WORK'],
        description: 'PASS = publishable with minor polish. NEEDS WORK = requires material revision.',
      },
      qualityStatus: {
        type: 'string',
        enum: ['pass', 'needs_review', 'blocked'],
        description: 'Severity gate: "blocked" if factualIntegrity < 7 (hallucination or invented numbers detected). "needs_review" if factualIntegrity >= 7 but issues remain. "pass" if factualIntegrity >= 7 and overall >= 8.',
      },
      numericLintFindings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Deterministic numeric audit. For every percentage, statistic, date, dollar amount, ratio, or numeric claim in the narration: state whether it appears in KEY NUMBERS or KEY FACTS. Format: "FOUND: \'43%\' → in KEY NUMBERS" or "UNSUPPORTED: \'92%\' → not in Research Pack".',
      },
      topIssues: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 5,
        description: 'The most important specific issues to fix before publishing. Empty if verdict is PASS.',
      },
    },
  },
};

export async function runCritic(
  pack: ResearchPack,
  blueprint: Blueprint,
  sections: EpisodeSection[],
  stageTelemetry: StageTelemetry[],
): Promise<CriticReport> {
  const client = getSpikeClient();

  const fullNarration = sections
    .map(s => `[${s.name}]\n${s.narration}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a senior podcast producer and editorial critic for LumAI.

You evaluate whether an episode is ready to publish.

Your standards:
- Single narrator, expert briefing voice
- No fake personal experience or fabricated authority
- No AI-generated filler words
- Every factual claim must trace back to the Research Pack
- The thesis must be clearly stated and argued, not just mentioned
- The episode must pass the Retell Test: 48h later, listener can explain thesis + mechanism + one fact + one implication

NUMERIC AUDIT (mandatory):
- Read every percentage, statistic, date, dollar amount, ratio, or numeric claim in the narration.
- Cross-reference each against KEY NUMBERS and KEY FACTS provided below.
- Any number that does not appear in KEY NUMBERS or KEY FACTS is a hallucination. Flag it in numericLintFindings as "UNSUPPORTED".
- Numbers that do appear should be flagged as "FOUND".
- If the narration contains invented confidence scores, invented survey percentages, or invented growth rates not in the Research Pack, this is a factualIntegrity failure.

SEVERITY GATE — set qualityStatus as follows:
- "blocked"      → factualIntegrity score < 7 (hallucination detected, invented numbers, or serious factual failure)
- "needs_review" → factualIntegrity >= 7 but issues remain, or overallScore < 8
- "pass"         → factualIntegrity >= 7 AND overallScore >= 8 AND no significant unresolved issues

Be honest and specific. Score accurately — do not inflate.
A score of 8+ means the dimension is clearly good.
A score of 6-7 means acceptable but improvable.
Below 6 means the dimension has a real problem.`;

  const userContent = [
    '=== RESEARCH PACK (ground truth) ===',
    `THESIS: ${pack.thesis}`,
    '',
    'KEY FACTS (narrator may cite these):',
    pack.keyFacts.map(f => `  - ${f}`).join('\n'),
    '',
    'KEY NUMBERS (the ONLY specific quantitative claims the narrator may use):',
    pack.keyNumbers.length > 0
      ? pack.keyNumbers.map(n => `  - ${n}`).join('\n')
      : '  (none — narration must contain zero invented numbers)',
    '',
    'SOURCE REFS (the only sources the narrator may name):',
    pack.sourceRefs.length > 0
      ? pack.sourceRefs.map(s => `  - ${s}`).join('\n')
      : '  (none)',
    '',
    'CLAIMS BY CONFIDENCE:',
    pack.claims.map(c => `  [${c.confidence}] ${c.text}`).join('\n'),
    '',
    'COUNTERARGUMENTS THE EPISODE SHOULD ENGAGE:',
    pack.counterarguments.map(c => `  - ${c}`).join('\n'),
    '',
    '=== BLUEPRINT (intended structure) ===',
    `TITLE: ${blueprint.title}`,
    `OPENING ANGLE: ${blueprint.openingAngle}`,
    `NARRATIVE SHAPE: ${blueprint.narrativeShape}`,
    '',
    '=== EPISODE TRANSCRIPT ===',
    fullNarration,
    '',
    'Audit all numeric claims in the narration against KEY NUMBERS and KEY FACTS. Then critique the full episode.',
  ].join('\n');

  const t0 = Date.now();
  const message = await client.messages.create(
    {
      model: SPIKE_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      tools: [CRITIC_TOOL],
      tool_choice: { type: 'tool', name: CRITIC_TOOL_NAME },
      messages: [{ role: 'user', content: userContent }],
    },
    { timeout: 150_000 },
  );

  stageTelemetry.push(recordTelemetry('critic', message, Date.now() - t0));

  const raw = extractToolInput(message, CRITIC_TOOL_NAME);

  // Claude occasionally returns nested dimension objects as JSON strings rather
  // than real objects, and string enum fields wrapped in extra quotes.
  // Normalize both before returning.
  const dimKeys = [
    'thesisClarity', 'openingStrength', 'factualIntegrity',
    'spokenNaturalness', 'narrativeCoherence', 'retellTestReadiness',
  ] as const;
  for (const key of dimKeys) {
    if (typeof raw[key] === 'string') {
      try {
        raw[key] = JSON.parse(raw[key] as string);
      } catch { /* leave malformed string as-is; renderMarkdown will show undefined */ }
    }
  }

  // Strip spurious surrounding quotes from string enum fields (e.g. '"PASS"' → 'PASS')
  for (const key of ['verdict', 'qualityStatus'] as const) {
    if (typeof raw[key] === 'string') {
      raw[key] = (raw[key] as string).replace(/^"|"$/g, '');
    }
  }

  return raw as unknown as CriticReport;
}
