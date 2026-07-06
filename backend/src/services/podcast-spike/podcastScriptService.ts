import type Anthropic from '@anthropic-ai/sdk';
import type {
  ResearchPack, Blueprint, BlueprintSection,
  EpisodeSection, StageTelemetry,
} from './podcastSpikeTypes';
import { getSpikeClient, SPIKE_MODEL, extractToolInput, recordTelemetry } from './spikeClient';

// Stage 3: Sequential section generation with rolling covered-points ledger.
//
// Caching strategy:
//   system prompt   → cached (identical for all sections)
//   pack+blueprint  → first user message block, cached (identical for all sections)
//   section tail    → second user message block, NOT cached (changes each section)
//
// This gives cache hits on the large system+context prefix for sections 2+.

const SECTION_TOOL_NAME = 'emit_section';

const SECTION_TOOL: Anthropic.Tool = {
  name: SECTION_TOOL_NAME,
  description: 'Emit a completed episode section with clean narration and metadata.',
  input_schema: {
    type: 'object' as const,
    required: ['narration', 'coveredPoints'],
    properties: {
      narration: {
        type: 'string',
        description: [
          'Clean spoken narration ONLY.',
          'No markdown headings, no bullet lists, no numbered lists.',
          'No [pause], no (emphasis), no SSML tags, no stage directions.',
          'No "I remember when..." or invented personal experience.',
          'No "fascinating", "delve", "game-changer", "leverage", or AI-generated filler.',
          'Natural spoken register: shorter sentences, active voice, direct address.',
          'Every sentence carries weight. No padding.',
        ].join(' '),
      },
      annotations: {
        type: 'array',
        description: 'TTS metadata annotations (character offsets). NOT displayed to users.',
        items: {
          type: 'object',
          required: ['type', 'charOffset'],
          properties: {
            type: { type: 'string', enum: ['pause', 'emphasis', 'breath'] },
            charOffset: { type: 'number', description: 'Character position in the narration string.' },
            value: { type: 'string', description: 'Duration (ms for pause) or level (high/low for emphasis).' },
          },
        },
      },
      coveredPoints: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 6,
        description: 'Specific ideas, facts, or arguments this section covered. These go into the no-repeat ledger for subsequent sections.',
      },
    },
  },
};

function buildNarratorSystem(language: 'en' | 'he'): string {
  const langInstruction = language === 'he'
    ? 'You write in spoken Israeli Hebrew. Natural conversational register — not formal written Hebrew. Every sentence must sound natural when read aloud in Hebrew.'
    : 'You write in spoken English. Every sentence must sound natural when read aloud.';

  return `You are the LumAI narrator: a senior analyst explaining the real meaning of research to a smart peer.

${langInstruction}

Your voice:
- Expert, direct, no corporate filler
- No fake personal experience ("I remember when...", "In my years of experience...")
- No fabricated authority ("As a former Goldman analyst...")
- No artificial stretching or padding
- No invented anecdotes
- No "fascinating", "delve", "unlock potential", "game-changer", "leverage", "crucial", "it's worth noting"
- No intro clichés ("Welcome back to...", "Today we're going to explore...")
- No bullet-list reading aloud ("Number one... Number two...")
- No chapter announcements ("In this section we will...")

NUMERIC INTEGRITY (non-negotiable):
- ONLY use numbers that appear verbatim in KEY NUMBERS.
- If KEY NUMBERS shows "(none — do not invent any)", this episode must contain ZERO specific quantitative claims.
- NEVER invent: percentages, confidence scores, rankings, survey results, growth rates, dollar amounts, dates, ratios, or any measurement not present in KEY NUMBERS.
- A fabricated number is far worse than no number. If you do not have a number, do not estimate one.
- This includes confidence-level language like "with 92% confidence" or "studies show 91%" — do not use any numeric confidence claim not in the Research Pack.

UNCERTAINTY HANDLING:
- Claims marked [uncertain] MUST be narrated with natural spoken hedging.
- Acceptable hedges: "The evidence points in this direction, but it is not conclusive." / "This should be treated as a signal, not a settled fact." / "The research raises a concern here, but has not proven causation." / "It is plausible that... though the evidence is not definitive."
- Do NOT convert [uncertain] claims into confident conclusions.
- Never say "the research shows" for an [uncertain] claim. Say "the research suggests" or "the concern is".
- Never say "studies prove" or "it has been shown" for an uncertain claim.

Your role:
- You explain the THESIS, not just the topic
- You follow the beats in order — not as a list, as an argument
- Every sentence earns its place
- You acknowledge counterarguments by weaving them in, not disclaiming them
- Facts from the Research Pack only — never invent

The Retell Test: a listener 48 hours later can explain the thesis, mechanism, one key fact, and one implication in two minutes.`;
}

function buildCachedPrefix(pack: ResearchPack, blueprint: Blueprint): string {
  const uncertainClaims = pack.claims.filter(c => c.confidence === 'uncertain');

  const lines: string[] = [
    '=== RESEARCH PACK ===',
    `THESIS: ${pack.thesis}`,
    `LANGUAGE: ${pack.language}`,
    `AUDIENCE: ${pack.audience}`,
    '',
    'VERIFIED FACTS THE NARRATOR MAY USE:',
    ...pack.keyFacts.map(f => `  - ${f}`),
    '',
    'KEY NUMBERS (the ONLY specific quantitative claims you may use):',
    ...(pack.keyNumbers.length > 0
      ? pack.keyNumbers.map(n => `  - ${n}`)
      : ['  (none — do not invent any)']),
    '',
    'CLAIMS BY CONFIDENCE:',
    ...pack.claims.map(c => `  [${c.confidence}] ${c.text}`),
    '',
    ...(uncertainClaims.length > 0
      ? [
          'UNCERTAIN CLAIMS — YOU MUST HEDGE THESE IN SPOKEN LANGUAGE:',
          '(Use phrases like "the evidence suggests", "this is not conclusive", "should be treated as a signal")',
          ...uncertainClaims.map(c => `  ? ${c.text}`),
          '',
        ]
      : []),
    'COUNTERARGUMENTS (weave at least one in naturally):',
    ...pack.counterarguments.map(c => `  - ${c}`),
    '',
    'OPEN QUESTIONS (acknowledge at least one honestly):',
    ...pack.openQuestions.map(q => `  - ${q}`),
    '',
    '=== BLUEPRINT ===',
    `TITLE: ${blueprint.title}`,
    `OPENING ANGLE: ${blueprint.openingAngle}`,
    `NARRATIVE SHAPE: ${blueprint.narrativeShape}`,
    `CLOSING DIRECTION: ${blueprint.closingDirection}`,
    '',
    'NO-REPEAT LEDGER SEED (these concepts must NOT be re-explained once covered):',
    ...blueprint.noRepeatLedgerSeed.map(c => `  - ${c}`),
    '',
    'SECTION STRUCTURE:',
    ...blueprint.sections.map((s, i) =>
      `  ${i + 1}. ${s.name} (${s.wordBudget} words): ${s.objective}`
    ),
  ];
  return lines.join('\n');
}

function buildSectionTail(
  section: BlueprintSection,
  sectionIndex: number,
  totalSections: number,
  previousSectionEnd: string,
  coveredLedger: string[],
  noRepeatSeed: string[],
): string {
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === totalSections - 1;

  const lines: string[] = [];

  if (!isFirst && previousSectionEnd) {
    lines.push('=== PREVIOUS SECTION ENDED WITH ===');
    lines.push(previousSectionEnd);
    lines.push('');
  }

  if (coveredLedger.length > 0) {
    lines.push('=== ALREADY COVERED — DO NOT REPEAT ===');
    lines.push([...noRepeatSeed, ...coveredLedger].map(p => `  - ${p}`).join('\n'));
    lines.push('');
  }

  lines.push(`=== WRITE SECTION ${sectionIndex + 1} of ${totalSections}: "${section.name}" ===`);
  lines.push(`OBJECTIVE: ${section.objective}`);
  lines.push(`WORD BUDGET: ${section.wordBudget} words (±10% — stay close)`);
  lines.push('');
  lines.push('BEATS TO HIT (in this order):');
  for (const beat of section.beats) {
    lines.push(`  • ${beat}`);
  }
  lines.push('');

  if (isFirst) {
    lines.push('This is the OPENING section. Start directly with the idea — no preamble, no intro clichés.');
  } else if (isLast) {
    lines.push(`This is the CLOSING section. ${section.objective} End at the idea, not the clock.`);
  } else {
    lines.push('Continue from where the previous section left off. No transition phrases like "Moving on to...".');
  }

  lines.push('');
  lines.push('NUMERIC INTEGRITY REMINDER: Only cite numbers from KEY NUMBERS listed above. If KEY NUMBERS shows "(none — do not invent any)", make ZERO quantitative claims in this section.');

  return lines.join('\n');
}

// Generate a single section. Used by both the spike runner (via generateSections)
// and the production engine (for section-level resumability).
// completedSections provides the covered-points ledger and the previous section end.
export async function generateSingleSection(
  pack: ResearchPack,
  blueprint: Blueprint,
  sectionIndex: number,
  completedSections: EpisodeSection[],
  stageTelemetry: StageTelemetry[],
): Promise<EpisodeSection> {
  const client = getSpikeClient();
  const blueprintSection = blueprint.sections[sectionIndex];
  if (!blueprintSection) {
    throw new Error(`[podcast] No blueprint section at index ${sectionIndex}`);
  }

  const cachedPrefix = buildCachedPrefix(pack, blueprint);
  const narratorSystem = buildNarratorSystem(pack.language);
  const coveredLedger = completedSections.flatMap(s => s.coveredPoints);
  const previousSectionEnd = completedSections.length > 0
    ? getLastSentences(completedSections[completedSections.length - 1].narration, 3)
    : '';

  const sectionTail = buildSectionTail(
    blueprintSection,
    sectionIndex,
    blueprint.sections.length,
    previousSectionEnd,
    coveredLedger,
    blueprint.noRepeatLedgerSeed,
  );

  console.log(`  [section ${sectionIndex + 1}/${blueprint.sections.length}] "${blueprintSection.name}" (${blueprintSection.wordBudget} words)...`);

  const t0 = Date.now();
  const message = await client.messages.create(
    {
      model: SPIKE_MODEL,
      max_tokens: Math.max(2000, Math.ceil(blueprintSection.wordBudget * 1.8)),
      system: [
        {
          type: 'text',
          text: narratorSystem,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SECTION_TOOL],
      tool_choice: { type: 'tool', name: SECTION_TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: cachedPrefix,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: sectionTail,
            },
          ],
        },
      ],
    },
    { timeout: 120_000 },
  );

  stageTelemetry.push(recordTelemetry(`section-${sectionIndex + 1}-${blueprintSection.name}`, message, Date.now() - t0));

  const raw = extractToolInput(message, SECTION_TOOL_NAME) as {
    narration: string;
    annotations?: Array<{ type: string; charOffset: number; value?: string }>;
    coveredPoints?: string[];
  };

  const narration = dedupeNarration((raw.narration ?? '').trim());
  const annotations = (raw.annotations ?? []) as EpisodeSection['annotations'];
  const coveredPoints = raw.coveredPoints ?? [];
  const wordCount = narration.split(/\s+/).filter(Boolean).length;

  return {
    name: blueprintSection.name as EpisodeSection['name'],
    narration,
    annotations,
    coveredPoints,
    wordCount,
  };
}

export async function generateSections(
  pack: ResearchPack,
  blueprint: Blueprint,
  stageTelemetry: StageTelemetry[],
): Promise<EpisodeSection[]> {
  const sections: EpisodeSection[] = [];
  for (let i = 0; i < blueprint.sections.length; i++) {
    const section = await generateSingleSection(pack, blueprint, i, sections, stageTelemetry);
    sections.push(section);
  }
  return sections;
}

function getLastSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(-count).join(' ').trim();
}

// Strip exact duplicate paragraphs produced by the model.
// Short chunks (<= 40 chars) are kept unconditionally to avoid removing single-sentence transitions.
function dedupeNarration(narration: string): string {
  const paragraphs = narration.split(/\n{2,}/);
  const seen = new Set<string>();
  const deduped = paragraphs.filter(p => {
    const key = p.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key.length <= 40) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.join('\n\n');
}
