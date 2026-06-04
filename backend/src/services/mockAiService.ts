import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import type { SourceIntelligence } from '../schemas/aiContractSchemas';
import {
  ResearchContextSchema,
  FactCheckReportSchema,
  ContentPackageSchema,
  LinkedInContentSchema,
  FacebookContentSchema,
  InstagramContentSchema,
  NewsletterContentSchema,
  PodcastContentSchema,
  ImagePromptSchema,
  type ResearchContext,
  type FactCheckReport,
  type ContentPackage,
} from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Mock AI Service
//
// Generates structured mock data that EXACTLY follows the AI contract schemas.
// All three generators are pure functions — deterministic given the same input.
//
// Phase 8 replacement: swap these generators for real AI API calls.
// The validation, persistence, and UI layers remain unchanged.
// ─────────────────────────────────────────────────────────────────────────────

// ── Text utilities ────────────────────────────────────────────────────────────

function titleCase(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function topicFromTitle(title: string): string[] {
  // Strip common words to extract topic keywords
  const stopWords = new Set(['and', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'with', '&', '-', '2024', '2025', '2026']);
  return title
    .split(/\s+/)
    .filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2)
    .slice(0, 4);
}

// Language-agnostic fallbacks guaranteed to be valid (no spaces, length > 2)
const HASHTAG_FALLBACKS = ['#ContentStrategy', '#Insights', '#AI'];

function industryHashtags(industry: string, title: string): string[] {
  // Strip non-alphanumeric chars — for non-Latin scripts (e.g. Hebrew) all
  // characters are removed, leaving '#' which is filtered by the length guard.
  const extracted = [...topicFromTitle(title), ...topicFromTitle(industry)]
    .slice(0, 5)
    .map(w => `#${w.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter(h => h.length > 2); // '#' + at least 1 char

  // Fallbacks guarantee ≥ 2 valid hashtags even when all input is non-Latin
  return [...new Set([...extracted, ...HASHTAG_FALLBACKS])].slice(0, 6);
}

function snippetFromSource(source: ContentSource): string {
  if (source.type === 'url') return `Source: ${source.content}`;
  if (source.type === 'pdf') return `Document: ${source.content}`;
  return source.content.length > 100
    ? source.content.slice(0, 100).trimEnd() + '…'
    : source.content;
}

// Use source intelligence if available; fall back to raw snippet
function describeSource(source: ContentSource): string {
  const si = source.sourceIntelligence as SourceIntelligence | null;
  if (si?.summary) return si.summary;
  return snippetFromSource(source);
}

// Extract topics from source intelligence or derive from label
function sourceTopics(source: ContentSource): string[] {
  const si = source.sourceIntelligence as SourceIntelligence | null;
  if (si?.topics?.length) return si.topics;
  return source.label.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
}

// Extract claims from source intelligence or derive from content
function sourceClaims(source: ContentSource): string[] {
  const si = source.sourceIntelligence as SourceIntelligence | null;
  if (si?.claims?.length) return si.claims;
  return source.type === 'text'
    ? [`From "${source.label}": ${snippetFromSource(source)}`]
    : [];
}

// Average confidence from source intelligence; default 80
function avgConfidence(sources: ContentSource[]): number {
  const scores = sources
    .map(s => (s.sourceIntelligence as SourceIntelligence | null)?.confidenceScore)
    .filter((n): n is number => typeof n === 'number');
  return scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 80;
}

// ── Stage 1: Research Context ─────────────────────────────────────────────────

export function generateResearchContext(
  run: PipelineRun,
  caseItem: ContentCase,
  primarySources: ContentSource[],
  contextSources: ContentSource[],
): ResearchContext {
  const { title, industry, targetAudience, goals, language } = caseItem;
  const keywords = topicFromTitle(title);
  const primaryCount = primarySources.length;
  const contextCount = contextSources.length;

  const context: ResearchContext = {
    runId:    run.id,
    caseId:   caseItem.id,
    language: language as 'en' | 'he',

    summary:
      `Research analysis for "${title}" targeting ${targetAudience} in the ${industry} sector. ` +
      `Processed ${primaryCount} primary source${primaryCount !== 1 ? 's' : ''}` +
      (contextCount > 0 ? ` with ${contextCount} contextual reference${contextCount !== 1 ? 's' : ''} for consistency.` : '.'),

    // Use source intelligence topics to enrich the main topics list
    mainTopics: [
      titleCase(keywords[0] ?? title) + ' landscape overview',
      'Key developments and trends in ' + industry,
      'Implications for ' + targetAudience,
      ...primarySources.flatMap(sourceTopics).slice(0, 3).map(t => titleCase(t) + ' analysis'),
    ].filter((t, i, arr) => arr.indexOf(t) === i).slice(0, 5),

    keyInsights: [
      `${titleCase(keywords[0] ?? 'The topic')} is reshaping how ${targetAudience} approach their work.`,
      `Early adopters in ${industry} are already seeing measurable results.`,
      `Source intelligence across ${primaryCount} primary source${primaryCount !== 1 ? 's' : ''} reveals consistent patterns.`,
      goals ? `The stated goal — "${goals.slice(0, 80)}" — is well-supported by the evidence.` : 'The evidence strongly supports the content goals.',
    ].filter(Boolean).slice(0, 4),

    // Source intelligence claims first; fall back to raw content snippet
    importantClaims: primarySources
      .flatMap(s => {
        const claims = sourceClaims(s);
        return claims.length > 0 ? claims : [`From "${s.label}": ${describeSource(s)}`];
      })
      .slice(0, Math.min(primaryCount * 2, 8)),

    suggestedAngles: [
      `The ROI perspective: quantifying ${keywords[0] ?? 'the impact'} for ${targetAudience}`,
      `The adoption timeline: where ${industry} is headed in the next 12 months`,
      `The risk perspective: what happens if ${targetAudience} don't act`,
      `The case study angle: organizations already seeing results`,
    ].slice(0, 4),

    suggestedHooks: [
      `What if ${targetAudience} could ${keywords[0] ? keywords[0].toLowerCase() : 'do this'} 10x faster?`,
      `The ${industry} industry is at an inflection point — here's why it matters to you.`,
      `Most ${targetAudience} don't realize how fast ${title.split(' ')[0]} is changing.`,
    ],

    sourceReferences: [
      ...primarySources.map(s => s.label || s.type),
      ...contextSources.map(s => `[Context] ${s.label || s.type}`),
    ],

    contradictions: contextSources.length > 0
      ? ['Minor inconsistencies noted between primary sources and historical context — flagged for fact-check.']
      : [],

    risks: [
      'Verify all statistical claims before publication.',
      'Ensure industry-specific claims are current at the time of publishing.',
    ],

    // Confidence derived from source intelligence scores; capped at 95
    confidenceScore: Math.min(95, avgConfidence(primarySources) + primaryCount * 2),
  };

  return ResearchContextSchema.parse(context);
}

// ── Stage 2: Fact Check Report ────────────────────────────────────────────────

export function generateFactCheckReport(
  run: PipelineRun,
  researchContext: ResearchContext,
  primarySources: ContentSource[],
  contextSources: ContentSource[],
): FactCheckReport {
  const claims = researchContext.importantClaims;
  const confidence = Math.min(97, researchContext.confidenceScore + 4);

  const verified = claims.slice(0, Math.max(1, Math.floor(claims.length * 0.7))).map(claim => ({
    claim,
    status: 'verified' as const,
    confidenceScore: Math.floor(85 + Math.random() * 12),
    supportingSources: primarySources.slice(0, 2).map(s => s.label || s.type),
    notes: 'Cross-referenced against available sources. Claim is well-supported.',
  }));

  const uncertain = claims.slice(verified.length).map(claim => ({
    claim,
    status: 'uncertain' as const,
    confidenceScore: Math.floor(55 + Math.random() * 25),
    supportingSources: primarySources.slice(0, 1).map(s => s.label || s.type),
    notes: 'Claim is plausible but could not be fully verified from available sources. Recommend hedging language.',
  }));

  const report: FactCheckReport = {
    runId:  run.id,
    caseId: researchContext.caseId,

    claimsChecked:   claims.length,
    verifiedClaims:  verified,
    uncertainClaims: uncertain,
    conflictingClaims: [],

    warnings: [
      ...(uncertain.length > 0 ? [`${uncertain.length} claim${uncertain.length !== 1 ? 's' : ''} could not be fully verified — recommend reviewing before publishing.`] : []),
      ...(contextSources.length > 0 ? ['Previous context sources reviewed for consistency.'] : []),
    ],

    overallConfidenceScore: confidence,

    sourceReferences: [
      ...primarySources.map(s => s.label || s.type),
      ...contextSources.map(s => `[Context] ${s.label || s.type}`),
    ],
  };

  return FactCheckReportSchema.parse(report);
}

// ── Stage 3: Content Package ──────────────────────────────────────────────────

export function generateContentPackage(
  run: PipelineRun,
  caseItem: ContentCase,
  researchContext: ResearchContext,
  factCheckReport: FactCheckReport,
): ContentPackage {
  const { title, industry, targetAudience, writingStyle, goals } = caseItem;
  const hook = researchContext.suggestedHooks[0] ?? `How ${title} is changing ${industry}.`;
  const insight = researchContext.keyInsights[0] ?? `${title} is transforming the ${industry} sector.`;
  const angle = researchContext.suggestedAngles[0] ?? `The impact of ${title} on ${targetAudience}.`;
  const hashtags = industryHashtags(industry, title);

  const confidenceLine =
    factCheckReport.overallConfidenceScore >= 90
      ? `All key claims have been cross-referenced and verified.`
      : `Most claims have been verified; a few require additional sourcing.`;

  // ── LinkedIn ────────────────────────────────────────────────────────────────
  const linkedin = LinkedInContentSchema.parse({
    title: title,
    hook:  hook,
    body: [
      insight,
      '',
      angle,
      '',
      `Here's what this means for ${targetAudience}:`,
      researchContext.mainTopics.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n'),
      '',
      goals ? `Our goal: ${goals.slice(0, 120)}${goals.length > 120 ? '…' : ''}` : '',
      '',
      confidenceLine,
    ].filter(l => l !== undefined).join('\n').trim(),
    hashtags: (() => {
      // industryHashtags() already guarantees ≥ 2 via HASHTAG_FALLBACKS.
      // Strip the raw industry tag attempt — it produces '#' for non-Latin scripts.
      const industrySlug = industry.split(/\s|&/)[0].replace(/[^a-zA-Z0-9]/g, '');
      const extra = industrySlug.length > 0 ? [`#${industrySlug}`] : [];
      return [...new Set([...hashtags, ...extra])]
        .filter(h => h.length > 2)   // '#' (length 1) and '#x' (length 2) are rejected
        .slice(0, 7);
    })(),
  });

  // ── Facebook ────────────────────────────────────────────────────────────────
  const facebook = FacebookContentSchema.parse({
    title: `${title} — What You Need to Know`,
    body: [
      `Have you been following what's happening with ${title}? 🚀`,
      '',
      insight,
      '',
      `For ${targetAudience}, this means real opportunities are emerging right now. ${angle}`,
      '',
      `We've been digging into ${researchContext.mainTopics[0]} and the results are fascinating.`,
      '',
      researchContext.keyInsights.slice(1, 3).map(i => `✅ ${i}`).join('\n'),
    ].join('\n'),
    callToAction: `What's your take? Drop a comment below or share with your network.`,
    imagePromptRef: 'shared_social_image',
  });

  // ── Instagram ───────────────────────────────────────────────────────────────
  const strongLine = researchContext.mainTopics[0]
    ? `${researchContext.mainTopics[0].split(' ').slice(0, 5).join(' ')} changes everything.`
    : `${title} changes everything.`;

  const instagram = InstagramContentSchema.parse({
    strongLine: strongLine.length > 120 ? strongLine.slice(0, 117) + '…' : strongLine,
    caption: [
      insight,
      '',
      `${angle} 👇`,
      '',
      hashtags.slice(0, 5).join(' '),
    ].join('\n'),
    imagePromptRef: 'instagram_image',
  });

  // ── Newsletter ──────────────────────────────────────────────────────────────
  const newsletter = NewsletterContentSchema.parse({
    subject:     `[${industry}] ${title}: What's changing and why it matters`,
    previewText: insight.slice(0, 100),
    body: [
      `Dear ${targetAudience},`,
      '',
      `This week, we're covering ${title} — and why it's more important than ever for ${industry}.`,
      '',
      `## The Big Picture`,
      insight,
      '',
      `## What We Found`,
      researchContext.mainTopics.map(t => `**${t}**`).join('\n'),
      '',
      `## Key Insights`,
      researchContext.keyInsights.map(i => `- ${i}`).join('\n'),
      '',
      `## Fact Check Summary`,
      `We reviewed ${factCheckReport.claimsChecked} claim${factCheckReport.claimsChecked !== 1 ? 's' : ''} from our sources. ` +
      `${factCheckReport.verifiedClaims.length} verified, ${factCheckReport.uncertainClaims.length} flagged for further review.`,
      '',
      factCheckReport.warnings.length > 0 ? `⚠️ ${factCheckReport.warnings[0]}` : '',
      '',
      `${writingStyle ? `*Written in ${writingStyle} style.*` : ''}`,
    ].filter(l => l !== undefined).join('\n').trim(),
    callToAction: goals
      ? `Ready to act on these insights? ${goals.slice(0, 80)}${goals.length > 80 ? '…' : ''}`
      : `Reply to this email with your thoughts — we read every response.`,
  });

  // ── Podcast ─────────────────────────────────────────────────────────────────
  const podcast = PodcastContentSchema.parse({
    title: `${title} — Deep Dive`,
    intro: [
      `Welcome to today's episode. I'm talking about ${title}, and I promise you — this is one you don't want to miss.`,
      `${insight}`,
      `Today, we're going to break this down for ${targetAudience} and talk about what it actually means in practice.`,
    ].join(' '),
    segments: [
      {
        title: 'The Context',
        content: [
          `Let's start with the big picture. ${researchContext.summary}`,
          `I want to give you a sense of why this moment matters. ${researchContext.mainTopics[0]} is not a future trend — it's happening now.`,
        ].join('\n\n'),
      },
      {
        title: 'The Key Findings',
        content: [
          `Now let's get into what the research actually shows.`,
          researchContext.keyInsights.map((insight, i) => `Point ${i + 1}: ${insight}`).join('\n\n'),
        ].join('\n\n'),
      },
      {
        title: 'The Fact Check',
        content: [
          `I always want to be rigorous here, so let's talk about what we verified.`,
          `We checked ${factCheckReport.claimsChecked} claims from our sources. Here's the breakdown:`,
          `- ${factCheckReport.verifiedClaims.length} claims verified with high confidence`,
          `- ${factCheckReport.uncertainClaims.length} claims flagged as uncertain — we're transparent about that`,
          factCheckReport.verifiedClaims.slice(0, 2).map(c => `  ✓ "${c.claim}" — ${c.notes}`).join('\n'),
        ].join('\n'),
      },
      {
        title: 'What This Means For You',
        content: [
          `OK, so what do you actually DO with this information?`,
          angle,
          `For ${targetAudience}, the practical implications are:`,
          researchContext.suggestedAngles.slice(0, 3).map((a, i) => `  ${i + 1}. ${a}`).join('\n'),
        ].join('\n\n'),
      },
    ],
    fullScript: [
      `[INTRO]`,
      `Welcome to today's episode. I'm talking about ${title}.`,
      `${insight}`,
      ``,
      `[CONTEXT]`,
      researchContext.summary,
      ``,
      `[KEY FINDINGS]`,
      researchContext.keyInsights.map((i, idx) => `Point ${idx + 1}: ${i}`).join('\n\n'),
      ``,
      `[FACT CHECK]`,
      `We reviewed ${factCheckReport.claimsChecked} claims. ${factCheckReport.verifiedClaims.length} verified. ${factCheckReport.uncertainClaims.length} uncertain.`,
      ``,
      `[WHAT THIS MEANS]`,
      angle,
      researchContext.suggestedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n'),
      ``,
      `[OUTRO]`,
      `That's it for today. If this resonated with you, subscribe and share it with someone in ${industry} who needs to hear it.`,
    ].join('\n'),
    closing: `Thanks for listening. ${goals ? goals.slice(0, 100) : `We'll be back next week with more insights for ${targetAudience}.`} Until then, take care.`,
  });

  // ── Image Prompts ────────────────────────────────────────────────────────────
  const visualStyle = writingStyle?.toLowerCase().includes('tech')
    ? 'Clean modern tech aesthetic, minimal design, bold typography'
    : 'Professional editorial photography, natural lighting, authentic feel';

  const mood = writingStyle?.toLowerCase().includes('bold') || writingStyle?.toLowerCase().includes('passionate')
    ? 'Energetic, forward-looking, confident'
    : 'Professional, trustworthy, thought-provoking';

  const package_: ContentPackage = {
    linkedin,
    facebook,
    instagram,
    newsletter,
    podcast,
    images: {
      instagramImage: ImagePromptSchema.parse({
        prompt:         `Square editorial image representing ${title}. Focus on ${researchContext.mainTopics[0]}. Vibrant, thumb-stopping visual for Instagram feed. ${industry} context. Clean composition with strong visual metaphor.`,
        aspectRatio:    '1:1',
        visualStyle:    `${visualStyle}, Instagram-optimized square format`,
        mood:           mood + ', visually striking',
        negativePrompt: 'blurry, cluttered, text overlays, stock photo clichés, low quality, watermarks',
      }),
      facebookLinkedinImage: ImagePromptSchema.parse({
        prompt:         `Landscape editorial image representing ${title} for professional social media. ${industry} context with ${targetAudience} in mind. Wide composition suitable for Facebook and LinkedIn feeds. Conveys ${researchContext.suggestedAngles[0] ?? 'professional insight'}.`,
        aspectRatio:    '1.91:1',
        visualStyle:    `${visualStyle}, landscape format optimized for social sharing`,
        mood:           mood,
        negativePrompt: 'portrait orientation, blurry, text overlays, stock photo clichés, low quality, watermarks',
      }),
    },
  };

  return ContentPackageSchema.parse(package_);
}

// ── Re-export schemas for use in pipelineService ─────────────────────────────

export { ResearchContextSchema, FactCheckReportSchema, ContentPackageSchema };
