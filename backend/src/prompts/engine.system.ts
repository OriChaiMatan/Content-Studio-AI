import type { GeneratorInput } from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Shared engine system prompt (Phase 9 CP-2)
// Stable per (platform, language) → cached. Platform instructions are appended
// after this block by each platform spec.
// ─────────────────────────────────────────────────────────────────────────────

export function engineSystem(lang: 'en' | 'he'): string {
  const language = lang === 'he' ? 'Hebrew' : 'English';
  return [
    'You are a platform-native content generation engine for a content studio.',
    '',
    'Your job: produce original, ready-to-publish content for ONE platform, plus its structured breakdown, using ONLY the provided Research Context, Fact Check Report, and Source Intelligence aggregate. You are NOT summarizing the sources — you are creating platform-native content.',
    '',
    'Hard rules:',
    '- Use ONLY facts present in the provided material. Never invent facts, statistics, names, quotes, dates, or events.',
    '- VERIFIED claims are safe to state. HEDGE or OMIT uncertain claims. NEVER state conflicting claims as fact.',
    '- Each platform has a distinct purpose, structure, rhythm, and tone. Follow the platform instructions precisely. Do NOT make every platform sound the same; in particular, Facebook/Instagram must not read like LinkedIn.',
    `- LANGUAGE: write ALL readyToPublish and breakdown text in ${language}. Proper nouns and product/company/technology names (e.g. Microsoft, Azure, AI, Security Copilot) may stay in their original language. Image-prompt fields must ALWAYS be written in ENGLISH (they feed an image model).`,
    '- readyToPublish must be the final, copy-paste-ready text for the platform. The breakdown must contain the same content decomposed into its named parts (they must be consistent).',
    '- Return ONLY the structured result via the provided tool. No preamble, no markdown fences, no extra fields.',
  ].join('\n');
}

// Renders the GeneratorInput projection into the user-turn context block.
// No raw article text — only the curated projection.
export function renderContext(input: GeneratorInput): string {
  const r = input.research;
  const f = input.facts;
  const s = input.sources;
  const b = input.brief;
  const list = (arr: string[]) => (arr.length ? arr.map(x => `- ${x}`).join('\n') : '- (none)');

  return [
    '## CASE BRIEF',
    `Title: ${b.caseTitle}`,
    `Goal: ${b.contentGoal}${b.goalCustom ? ` (${b.goalCustom})` : ''}`,
    `Style: ${b.contentStyle}${b.styleCustom ? ` (${b.styleCustom})` : ''}`,
    '',
    '## RESEARCH CONTEXT',
    `Summary: ${r.summary}`,
    `Main topics:\n${list(r.mainTopics)}`,
    `Key insights:\n${list(r.keyInsights)}`,
    `Important claims:\n${list(r.importantClaims)}`,
    `Suggested angles:\n${list(r.suggestedAngles)}`,
    `Suggested hooks:\n${list(r.suggestedHooks)}`,
    r.contradictions.length ? `Contradictions to avoid:\n${list(r.contradictions)}` : '',
    `Research confidence: ${r.confidenceScore}/100`,
    '',
    '## FACT CHECK (assertion allowlist / denylist)',
    `VERIFIED (safe to state):\n${list(f.verified.map(c => c.claim))}`,
    `UNCERTAIN (hedge or omit):\n${list(f.uncertain.map(c => c.claim))}`,
    `CONFLICTING (do NOT state as fact):\n${list(f.conflicting)}`,
    f.warnings.length ? `Warnings:\n${list(f.warnings)}` : '',
    `Overall fact-check confidence: ${f.overallConfidenceScore}/100`,
    '',
    '## SOURCE INTELLIGENCE (aggregate)',
    `Entities: ${s.entities.map(e => `${e.name} (${e.type})`).join(', ') || '(none)'}`,
    `Keywords: ${s.keywords.join(', ') || '(none)'}`,
    `Overall sentiment: ${s.sentiment}`,
    `Source count: ${s.sourceCount}`,
  ].filter(Boolean).join('\n');
}
