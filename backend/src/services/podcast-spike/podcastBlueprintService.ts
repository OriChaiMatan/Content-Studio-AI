import type Anthropic from '@anthropic-ai/sdk';
import type { ResearchPack, Blueprint, StageTelemetry } from './podcastSpikeTypes';
import { getSpikeClient, SPIKE_MODEL, extractToolInput, recordTelemetry } from './spikeClient';

// Stage 2: ResearchPack → Blueprint.
// The Blueprint is the episode's structural plan: sections, word budgets, beats.
// Duration is decided here based on research density — not forced to any target length.

const BLUEPRINT_TOOL_NAME = 'emit_blueprint';

const SECTION_NAMES_LIST = [
  'Opening', 'Background', 'Context', 'The Problem', 'The Story',
  'Main Analysis', 'The Argument', 'Deep Dive', 'The Evidence',
  'Implications', 'What This Means', 'The Stakes',
  'Looking Ahead', 'What Comes Next',
  'Closing', 'Final Thoughts',
].join(' | ');

const BLUEPRINT_TOOL: Anthropic.Tool = {
  name: BLUEPRINT_TOOL_NAME,
  description: 'Emit the complete Podcast Blueprint for this episode.',
  input_schema: {
    type: 'object' as const,
    required: [
      'title', 'subtitle', 'openingAngle', 'narrativeShape',
      'durationEstimateMin', 'estimatedWordCount',
      'sections', 'noRepeatLedgerSeed', 'closingDirection',
    ],
    properties: {
      title: { type: 'string', description: 'Episode title. Sharp, specific, not generic.' },
      subtitle: { type: 'string', description: 'One-sentence subtitle that sharpens the thesis.' },
      openingAngle: {
        type: 'string',
        description: 'The opening IDEA — the first thing the narrator says or implies. Not a sentence — an intellectual move.',
      },
      narrativeShape: {
        type: 'string',
        description: 'One sentence describing the narrative arc (e.g. "Sets up the paradox, examines the mechanism, then explains the implication").',
      },
      durationEstimateMin: {
        type: 'number',
        description: 'Integer minutes. limited→6-10min, medium→14-18min, high→22-28min.',
      },
      estimatedWordCount: {
        type: 'number',
        description: 'Total word count. Must equal durationEstimateMin × wpm (en=150, he=130).',
      },
      sections: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['name', 'objective', 'wordBudget', 'beats'],
          properties: {
            name: {
              type: 'string',
              enum: [
                'Opening', 'Background', 'Context', 'The Problem', 'The Story',
                'Main Analysis', 'The Argument', 'Deep Dive', 'The Evidence',
                'Implications', 'What This Means', 'The Stakes',
                'Looking Ahead', 'What Comes Next',
                'Closing', 'Final Thoughts',
              ],
            },
            objective: { type: 'string', description: 'What this section must accomplish for the thesis.' },
            wordBudget: { type: 'number', description: 'Target word count for this section.' },
            beats: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 5,
              description: 'Specific ideas or moves the section must hit, in order.',
            },
          },
        },
      },
      noRepeatLedgerSeed: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concepts that once explained must NOT be re-explained in later sections.',
      },
      closingDirection: {
        type: 'string',
        description: 'The intellectual/emotional register of the closing — what it leaves the listener with.',
      },
    },
  },
};

const WPM: Record<string, number> = { en: 150, he: 130 };

export async function buildBlueprint(
  pack: ResearchPack,
  stageTelemetry: StageTelemetry[],
): Promise<Blueprint> {
  const client = getSpikeClient();
  const wpm = WPM[pack.language] ?? 150;

  const systemPrompt = `You are a podcast director for LumAI, an expert editorial podcast.

Your job: create a structural Blueprint for a single-narrator expert episode.

This is NOT an entertainment podcast. It is a premium analyst briefing.
The episode must pass the Retell Test: 48 hours later, the listener can explain the thesis, the mechanism, one key fact, and one implication.

Duration rules (base on research density honestly):
- limited density: 6–10 min episode = ${6 * wpm}–${10 * wpm} words
- medium density: 14–18 min episode = ${14 * wpm}–${18 * wpm} words
- high density: 22–28 min episode = ${22 * wpm}–${28 * wpm} words

If the research is limited, produce a tight short briefing — do not pad it.

Section name constraint: ONLY these names are allowed:
${SECTION_NAMES_LIST}

4–6 sections. Opening and Closing are required. The section sequence must form one coherent argument — not a list of topics.

Word budgets must sum to estimatedWordCount ± 5%.`;

  const packedContent = `ResearchPack:

THESIS: ${pack.thesis}
LANGUAGE: ${pack.language}
AUDIENCE: ${pack.audience}
RESEARCH DENSITY: ${pack.researchDensity}
RECOMMENDATION: ${pack.podcastRecommendation.verdict} — ${pack.podcastRecommendation.reason}

KEY FACTS:
${pack.keyFacts.map(f => `  - ${f}`).join('\n')}

KEY NUMBERS:
${pack.keyNumbers.length > 0 ? pack.keyNumbers.map(n => `  - ${n}`).join('\n') : '  (none specific)'}

CLAIMS:
${pack.claims.map(c => `  [${c.confidence}] ${c.text}${c.sourceRef ? ` (${c.sourceRef})` : ''}`).join('\n')}

COUNTERARGUMENTS (episode must engage at least one):
${pack.counterarguments.map(c => `  - ${c}`).join('\n')}

OPEN QUESTIONS (episode should acknowledge at least one):
${pack.openQuestions.map(q => `  - ${q}`).join('\n')}

Design a Blueprint for this episode.`;

  const t0 = Date.now();
  const message = await client.messages.create(
    {
      model: SPIKE_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      tools: [BLUEPRINT_TOOL],
      tool_choice: { type: 'tool', name: BLUEPRINT_TOOL_NAME },
      messages: [{ role: 'user', content: packedContent }],
    },
    { timeout: 90_000 },
  );

  stageTelemetry.push(recordTelemetry('blueprint', message, Date.now() - t0));

  const raw = extractToolInput(message, BLUEPRINT_TOOL_NAME);
  return raw as unknown as Blueprint;
}
