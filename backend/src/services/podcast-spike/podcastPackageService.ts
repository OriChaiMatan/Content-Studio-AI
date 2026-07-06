import type Anthropic from '@anthropic-ai/sdk';
import type {
  ResearchPack, Blueprint, EpisodeSection, PodcastPackage, StageTelemetry,
} from './podcastSpikeTypes';
import { getSpikeClient, SPIKE_MODEL, extractToolInput, recordTelemetry } from './spikeClient';

// Stage 5: Package — executive summary, key takeaways, and outline with word offsets.
// V1 scope: no SEO, no Spotify/YouTube descriptions, no pull quotes.

const PACKAGE_TOOL_NAME = 'emit_package';

const PACKAGE_TOOL: Anthropic.Tool = {
  name: PACKAGE_TOOL_NAME,
  description: 'Emit the episode package: executive summary, takeaways, and outline.',
  input_schema: {
    type: 'object' as const,
    required: ['executiveSummary', 'keyTakeaways', 'outline'],
    properties: {
      executiveSummary: {
        type: 'string',
        description: '4–5 sentences, maximum 120 words. State: (1) the thesis, (2) the core mechanism or key finding, (3) one implication. Dense — no padding, no filler. Must be readable in under 30 seconds.',
      },
      keyTakeaways: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 5,
        description: 'What the listener walks away with. Specific and memorable — not generic.',
      },
      outline: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'wordOffset'],
          properties: {
            name: { type: 'string' },
            wordOffset: {
              type: 'number',
              description: 'Cumulative word count at the START of this section (for future chapter timestamps).',
            },
          },
        },
      },
    },
  },
};

export async function buildPackage(
  pack: ResearchPack,
  blueprint: Blueprint,
  sections: EpisodeSection[],
  stageTelemetry: StageTelemetry[],
): Promise<PodcastPackage> {
  const client = getSpikeClient();

  // Compute word offsets from actual section word counts
  const outlineWithOffsets = sections.map((s, i) => {
    const wordOffset = sections.slice(0, i).reduce((sum, prev) => sum + prev.wordCount, 0);
    return { name: s.name, wordOffset };
  });

  const fullNarration = sections
    .map(s => `[${s.name}]\n${s.narration}`)
    .join('\n\n');

  const userContent = [
    `THESIS: ${pack.thesis}`,
    `TITLE: ${blueprint.title}`,
    `SUBTITLE: ${blueprint.subtitle}`,
    '',
    'EPISODE OUTLINE:',
    outlineWithOffsets.map(o => `  ${o.name} (word ${o.wordOffset})`).join('\n'),
    '',
    'FULL NARRATION:',
    fullNarration,
    '',
    'Write the episode package.',
  ].join('\n');

  const t0 = Date.now();
  const message = await client.messages.create(
    {
      model: SPIKE_MODEL,
      max_tokens: 2000,
      system: 'You are packaging a finished LumAI podcast episode. Be dense and useful. No padding. Executive summary must be under 120 words — cut ruthlessly.',
      tools: [PACKAGE_TOOL],
      tool_choice: { type: 'tool', name: PACKAGE_TOOL_NAME },
      messages: [{ role: 'user', content: userContent }],
    },
    { timeout: 90_000 },
  );

  stageTelemetry.push(recordTelemetry('package', message, Date.now() - t0));

  const raw = extractToolInput(message, PACKAGE_TOOL_NAME) as {
    executiveSummary: string;
    keyTakeaways: string[];
    outline: Array<{ name: string; wordOffset: number }>;
  };

  return {
    executiveSummary: raw.executiveSummary,
    keyTakeaways: raw.keyTakeaways,
    outline: raw.outline as PodcastPackage['outline'],
  };
}
