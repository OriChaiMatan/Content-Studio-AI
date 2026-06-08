import Anthropic from '@anthropic-ai/sdk';
import { contentGenerationConfig } from '../lib/anthropic';
import {
  GeneratedOutputSchema,
  LinkedInBreakdownSchema,
  FacebookBreakdownSchema,
  InstagramBreakdownSchema,
  NewsletterBreakdownSchema,
  PodcastBreakdownSchema,
  type GeneratedOutput,
  type GeneratorInput,
  type ContentPlatform,
} from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Platform specs (Phase 9 CP-2)
//
// Claude returns the structured BREAKDOWN only (via a forced tool). The service
// validates it with the v2 Zod schemas and DETERMINISTICALLY assembles
// readyToPublish from the breakdown — this avoids asking Claude to duplicate the
// whole post (which doubled tokens and risked an empty readyToPublish) and keeps
// readyToPublish consistent with the breakdown.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformSpec {
  instruction: string;
  tool: Anthropic.Tool;
  maxTokens: number;
  longform: boolean;
  finalize: (raw: Record<string, unknown>, input: GeneratorInput) => GeneratedOutput;
}

const SEP = '─────────────────────────────────';

const imagePromptProps = {
  prompt:         { type: 'string', description: 'Image-generation prompt. ALWAYS in English.' },
  aspectRatio:    { type: 'string', description: 'e.g. "1:1", "1.91:1", "4:5"' },
  visualStyle:    { type: 'string' },
  mood:           { type: 'string' },
  negativePrompt: { type: 'string' },
};
const imagePromptRequired = ['prompt', 'aspectRatio', 'visualStyle', 'mood', 'negativePrompt'];

function img(raw: unknown, role: 'primary' | 'alternative') {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    role,
    prompt:         String(o.prompt ?? ''),
    aspectRatio:    String(o.aspectRatio ?? '1:1'),
    visualStyle:    String(o.visualStyle ?? ''),
    mood:           String(o.mood ?? ''),
    negativePrompt: String(o.negativePrompt ?? ''),
  };
}

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function baseMeta(input: GeneratorInput, extra: Record<string, unknown> = {}) {
  return {
    generatorVersion: 'claude-gen-1',
    model:            contentGenerationConfig.model,
    degraded:         false,
    contentScore:     Math.max(70, Math.round((input.research.confidenceScore + input.facts.overallConfidenceScore) / 2)),
    researchConfidence: input.research.confidenceScore,
    factCheckAccuracy:  input.facts.overallConfidenceScore,
    ...extra,
  };
}

const str = (v: unknown) => String(v ?? '');
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export const PLATFORM_SPECS: Record<ContentPlatform, PlatformSpec> = {
  // ── LinkedIn ────────────────────────────────────────────────────────────────
  linkedin: {
    maxTokens: 1500,
    longform: false,
    instruction: [
      'PLATFORM: LinkedIn. Purpose: authority, insight, and professional discussion.',
      'Tone: credible and substantive. NO emoji by default. Not clickbait.',
      'HARD LENGTH: the assembled post (hook + context + insight + numbered takeaways + cta + hashtags) MUST be between 650 and 1400 characters. Keep sections concise so the total stays in range.',
      'Return the breakdown: hook, context, insight, takeaways (3–5), cta, hashtags (0–3), imagePrompt (1).',
    ].join('\n'),
    tool: {
      name: 'record_linkedin_content',
      description: 'Record the LinkedIn breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' }, context: { type: 'string' }, insight: { type: 'string' },
          takeaways: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
          cta: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 3 },
          imagePrompt: { type: 'object', properties: imagePromptProps, required: imagePromptRequired },
        },
        required: ['hook', 'context', 'insight', 'takeaways', 'cta', 'hashtags', 'imagePrompt'],
      },
    },
    finalize: (raw, input) => {
      const breakdown = LinkedInBreakdownSchema.parse({
        hook: str(raw.hook), context: str(raw.context), insight: str(raw.insight),
        takeaways: strArr(raw.takeaways), cta: str(raw.cta),
        hashtags: strArr(raw.hashtags), imagePrompt: img(raw.imagePrompt, 'primary'),
      });
      const readyToPublish = [
        breakdown.hook, '', breakdown.context, '', breakdown.insight, '',
        breakdown.takeaways.map((x, i) => `${i + 1}. ${x}`).join('\n'), '', breakdown.cta,
        ...(breakdown.hashtags.length ? ['', breakdown.hashtags.join(' ')] : []),
      ].join('\n').trim();
      // HARD length rule (LinkedIn only): 650–1400 chars. Out-of-range fails
      // validation → corrective retry asks Claude to rewrite within range →
      // if still out-of-range, the service returns a v2 mock fallback. No
      // mechanical truncation, no silent over-length acceptance.
      const len = readyToPublish.length;
      if (len < 650 || len > 1400) {
        throw new Error(
          `LinkedIn assembled post is ${len} characters; it must be 650–1400. ` +
          `Rewrite the hook/context/insight/takeaways so the full post lands within 650–1400 characters ` +
          `(${len < 650 ? 'add more substance' : 'make it more concise'}).`,
        );
      }
      return GeneratedOutputSchema.parse({
        platform: 'linkedin', title: input.brief.caseTitle, readyToPublish, breakdown,
        metadata: baseMeta(input, { hashtags: breakdown.hashtags, imagePrompts: [breakdown.imagePrompt] }),
      });
    },
  },

  // ── Facebook ──────────────────────────────────────────────────────────────
  facebook: {
    maxTokens: 1500,
    longform: false,
    instruction: [
      'PLATFORM: Facebook. Purpose: community, conversation, human tone.',
      'Tone: warm, personal, conversational — must NOT read like LinkedIn. First person welcome.',
      'Length: around 150–500 words.',
      'Return the breakdown: hook, story, personalInterpretation, communityQuestion, hashtags (0–2), imagePrompt (1).',
    ].join('\n'),
    tool: {
      name: 'record_facebook_content',
      description: 'Record the Facebook breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' }, story: { type: 'string' }, personalInterpretation: { type: 'string' },
          communityQuestion: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 2 },
          imagePrompt: { type: 'object', properties: imagePromptProps, required: imagePromptRequired },
        },
        required: ['hook', 'story', 'personalInterpretation', 'communityQuestion', 'hashtags', 'imagePrompt'],
      },
    },
    finalize: (raw, input) => {
      const breakdown = FacebookBreakdownSchema.parse({
        hook: str(raw.hook), story: str(raw.story), personalInterpretation: str(raw.personalInterpretation),
        communityQuestion: str(raw.communityQuestion), hashtags: strArr(raw.hashtags),
        imagePrompt: img(raw.imagePrompt, 'primary'),
      });
      const readyToPublish = [
        breakdown.hook, '', breakdown.story, '', breakdown.personalInterpretation, '',
        breakdown.communityQuestion, ...(breakdown.hashtags.length ? ['', breakdown.hashtags.join(' ')] : []),
      ].join('\n').trim();
      return GeneratedOutputSchema.parse({
        platform: 'facebook', title: input.brief.caseTitle, readyToPublish, breakdown,
        metadata: baseMeta(input, { hashtags: breakdown.hashtags, imagePrompts: [breakdown.imagePrompt] }),
      });
    },
  },

  // ── Instagram ───────────────────────────────────────────────────────────────
  instagram: {
    maxTokens: 1500,
    longform: false,
    instruction: [
      'PLATFORM: Instagram. Purpose: visual-first, attention, emotion. NOT a carousel.',
      'Tone: punchy, emotive, scroll-stopping. Emoji allowed.',
      'Length: around 80–250 words (the caption).',
      'Return the breakdown: hook (strong first line), body, cta, hashtags (5–8), primaryImagePrompt, alternativeImagePrompt (two DISTINCT prompts).',
    ].join('\n'),
    tool: {
      name: 'record_instagram_content',
      description: 'Record the Instagram breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 8 },
          primaryImagePrompt: { type: 'object', properties: imagePromptProps, required: imagePromptRequired },
          alternativeImagePrompt: { type: 'object', properties: imagePromptProps, required: imagePromptRequired },
        },
        required: ['hook', 'body', 'cta', 'hashtags', 'primaryImagePrompt', 'alternativeImagePrompt'],
      },
    },
    finalize: (raw, input) => {
      const breakdown = InstagramBreakdownSchema.parse({
        hook: str(raw.hook), body: str(raw.body), cta: str(raw.cta), hashtags: strArr(raw.hashtags),
        primaryImagePrompt: img(raw.primaryImagePrompt, 'primary'),
        alternativeImagePrompt: img(raw.alternativeImagePrompt, 'alternative'),
      });
      const readyToPublish = [breakdown.hook, '', breakdown.body, '', breakdown.cta, '', breakdown.hashtags.join(' ')].join('\n').trim();
      return GeneratedOutputSchema.parse({
        platform: 'instagram', title: input.brief.caseTitle, readyToPublish, breakdown,
        metadata: baseMeta(input, { hashtags: breakdown.hashtags, imagePrompts: [breakdown.primaryImagePrompt, breakdown.alternativeImagePrompt] }),
      });
    },
  },

  // ── Newsletter ────────────────────────────────────────────────────────────
  newsletter: {
    maxTokens: 4000,
    longform: true,
    instruction: [
      'PLATFORM: Newsletter. Purpose: education and analysis. Analytical, not salesy.',
      'Length: around 600–1200 words (mainAnalysis is the substantial body).',
      'Return the breakdown: subject, previewText, opening, mainAnalysis, practicalTakeaways (1–8), closingInsight, cta. No image prompt.',
    ].join('\n'),
    tool: {
      name: 'record_newsletter_content',
      description: 'Record the newsletter breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' }, previewText: { type: 'string' }, opening: { type: 'string' },
          mainAnalysis: { type: 'string' },
          practicalTakeaways: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
          closingInsight: { type: 'string' }, cta: { type: 'string' },
        },
        required: ['subject', 'previewText', 'opening', 'mainAnalysis', 'practicalTakeaways', 'closingInsight', 'cta'],
      },
    },
    finalize: (raw, input) => {
      const breakdown = NewsletterBreakdownSchema.parse({
        subject: str(raw.subject), previewText: str(raw.previewText), opening: str(raw.opening),
        mainAnalysis: str(raw.mainAnalysis), practicalTakeaways: strArr(raw.practicalTakeaways),
        closingInsight: str(raw.closingInsight), cta: str(raw.cta),
      });
      const readyToPublish = [
        `Subject: ${breakdown.subject}`, `Preview: ${breakdown.previewText}`, '', SEP, '',
        breakdown.opening, '', breakdown.mainAnalysis, '',
        breakdown.practicalTakeaways.map(x => `- ${x}`).join('\n'), '',
        breakdown.closingInsight, '', breakdown.cta,
      ].join('\n').trim();
      const readingTimeMinutes = Math.max(1, Math.round(words(readyToPublish) / 200));
      return GeneratedOutputSchema.parse({
        platform: 'newsletter', title: breakdown.subject, readyToPublish, breakdown,
        metadata: baseMeta(input, { readingTimeMinutes }),
      });
    },
  },

  // ── Podcast ───────────────────────────────────────────────────────────────
  podcast: {
    maxTokens: 16000,
    longform: true,
    instruction: [
      'PLATFORM: Podcast (deep-dive expert episode). Spoken style — NOT an article. Write to be read aloud.',
      'Target: a 30–45 minute episode (roughly 4,500–6,750 spoken words in fullScript).',
      'Return the breakdown: title, description, chapters (each {title, summary}), openingHook, background, whatHappened, whyItMatters, biggerPicture, whatMostPeopleMiss, practicalActions, closingThoughts, cta, fullScript. No image prompt.',
      'fullScript is the complete spoken script.',
    ].join('\n'),
    tool: {
      name: 'record_podcast_content',
      description: 'Record the podcast breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' }, description: { type: 'string' },
          chapters: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'object', properties: { title: { type: 'string' }, summary: { type: 'string' } }, required: ['title', 'summary'] } },
          openingHook: { type: 'string' }, background: { type: 'string' }, whatHappened: { type: 'string' },
          whyItMatters: { type: 'string' }, biggerPicture: { type: 'string' }, whatMostPeopleMiss: { type: 'string' },
          practicalActions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
          closingThoughts: { type: 'string' }, cta: { type: 'string' }, fullScript: { type: 'string' },
        },
        required: ['title', 'description', 'chapters', 'openingHook', 'background', 'whatHappened',
          'whyItMatters', 'biggerPicture', 'whatMostPeopleMiss', 'practicalActions', 'closingThoughts', 'cta', 'fullScript'],
      },
    },
    finalize: (raw, input) => {
      const chapters = Array.isArray(raw.chapters)
        ? (raw.chapters as Record<string, unknown>[]).map(c => ({ title: str(c.title), summary: str(c.summary) }))
        : [];
      const breakdown = PodcastBreakdownSchema.parse({
        title: str(raw.title), description: str(raw.description), chapters,
        openingHook: str(raw.openingHook), background: str(raw.background), whatHappened: str(raw.whatHappened),
        whyItMatters: str(raw.whyItMatters), biggerPicture: str(raw.biggerPicture), whatMostPeopleMiss: str(raw.whatMostPeopleMiss),
        practicalActions: strArr(raw.practicalActions), closingThoughts: str(raw.closingThoughts),
        cta: str(raw.cta), fullScript: str(raw.fullScript),
      });
      const readyToPublish = [`🎙️ ${breakdown.title}`, '', SEP, '', breakdown.fullScript].join('\n').trim();
      const estimatedWordCount = words(breakdown.fullScript);
      const estimatedDurationMinutes = Math.max(1, Math.round(estimatedWordCount / 150));
      return GeneratedOutputSchema.parse({
        platform: 'podcast', title: breakdown.title, readyToPublish, breakdown,
        metadata: baseMeta(input, { estimatedWordCount, estimatedDurationMinutes }),
      });
    },
  },
};
