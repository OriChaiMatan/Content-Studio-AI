import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
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

// Shape-tolerant view of sourceIntelligence.
// Supports BOTH the new Phase 8 shape and legacy records:
//   topics → mainTopics, confidenceScore → analysisConfidenceScore,
//   claims: string[] (legacy) → claims: Claim[] (new).
type LegacySI = {
  summary?: string;
  topics?: string[];                 // legacy
  mainTopics?: string[];             // new
  claims?: string[] | { text: string }[]; // legacy string[] OR new Claim[]
  entities?: { name: string }[];     // new
  confidenceScore?: number;          // legacy
  analysisConfidenceScore?: number;  // new
};

function readSI(source: ContentSource): LegacySI | null {
  return (source.sourceIntelligence as LegacySI | null) ?? null;
}

// Use source intelligence summary if available; fall back to raw snippet
function describeSource(source: ContentSource): string {
  const si = readSI(source);
  if (si?.summary) return si.summary;
  return snippetFromSource(source);
}

// Extract topics — prefers mainTopics (new), falls back to topics (legacy)
function sourceTopics(source: ContentSource): string[] {
  const si = readSI(source);
  const topics = si?.mainTopics ?? si?.topics;
  if (topics?.length) return topics;
  return source.label.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
}

// Extract claim text — handles Claim[] (new) and string[] (legacy)
function sourceClaims(source: ContentSource): string[] {
  const si = readSI(source);
  if (si?.claims?.length) {
    return si.claims.map(c => (typeof c === 'string' ? c : c.text));
  }
  return source.type === 'text'
    ? [`From "${source.label}": ${snippetFromSource(source)}`]
    : [];
}

// Average analysis confidence — prefers analysisConfidenceScore (new),
// falls back to confidenceScore (legacy); default 80
function avgConfidence(sources: ContentSource[]): number {
  const scores = sources
    .map(s => {
      const si = readSI(s);
      return si?.analysisConfidenceScore ?? si?.confidenceScore;
    })
    .filter((n): n is number => typeof n === 'number');
  return scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 80;
}

// Named entities from sourceIntelligence (new shape only). Used to enrich copy.
function sourceEntities(sources: ContentSource[]): string[] {
  const names = sources.flatMap(s => readSI(s)?.entities ?? []).map(e => e.name).filter(Boolean);
  return [...new Set(names)];
}

// ── Case-field derivation (Phase 8.5 fix) ─────────────────────────────────────
// The simplified wizard leaves targetAudience / industry / goals / writingStyle
// blank, which produced empty placeholders ("targeting  in the  sector"). These
// helpers derive safe, non-empty wording from the new fields (contentGoal,
// contentStyle, title) and source intelligence — never returning "".

const GOAL_PHRASES: Record<string, string> = {
  build_authority:  'establishing authority',
  generate_leads:   'generating qualified leads',
  increase_sales:   'driving sales',
  educate_audience: 'educating the audience',
  grow_community:   'growing the community',
  personal_branding:'building a personal brand',
  other:            'the content goals',
};

const GOAL_PHRASES_HE: Record<string, string> = {
  build_authority:  'ביסוס סמכות מקצועית',
  generate_leads:   'יצירת לידים',
  increase_sales:   'הגדלת מכירות',
  educate_audience: 'חינוך הקהל',
  grow_community:   'הגדלת הקהילה',
  personal_branding:'בניית מותג אישי',
  other:            'יעדי התוכן',
};

function caseAudience(c: ContentCase): string {
  return (c.targetAudience ?? '').trim() || 'your audience';
}

// Prefer an explicit industry; else a source topic; else a title keyword; else generic.
function caseSector(c: ContentCase, topics: string[]): string {
  const ind = (c.industry ?? '').trim();
  if (ind) return ind;
  const topic = topics.find(t => t && t.trim());
  if (topic) return topic.trim();
  const fromTitle = topicFromTitle(c.title)[0];
  return fromTitle || 'this space';
}

function caseGoalText(c: ContentCase): string {
  const g = (c.goals ?? '').trim();
  if (g) return g;
  const custom = (c.goalCustom ?? '').trim();
  if (custom) return custom;
  return GOAL_PHRASES[c.contentGoal as unknown as string] ?? 'the content goals';
}

function caseStyleText(c: ContentCase): string {
  const w = (c.writingStyle ?? '').trim();
  if (w) return w;
  const custom = (c.styleCustom ?? '').trim();
  if (custom) return custom;
  return (c.contentStyle as unknown as string) || 'professional';
}

// Resolve the output language for a run (Phase 8.6): the run's outputLanguage
// wins; otherwise fall back to the case language; otherwise English.
function resolveOutputLang(
  run: { outputLanguage?: string | null },
  caseItem: { language?: string | null },
): 'en' | 'he' {
  if (run.outputLanguage === 'he') return 'he';
  if (run.outputLanguage === 'en') return 'en';
  return caseItem.language === 'he' ? 'he' : 'en';
}

// ── Stage 1: Research Context ─────────────────────────────────────────────────

export function generateResearchContext(
  run: PipelineRun,
  caseItem: ContentCase,
  primarySources: ContentSource[],
  contextSources: ContentSource[],
): ResearchContext {
  // Output language is chosen per run (Phase 8.6). Hebrew runs use a dedicated
  // Hebrew mock builder; English keeps the existing path.
  if (resolveOutputLang(run, caseItem) === 'he') {
    return ResearchContextSchema.parse(hebrewResearchContext(run, caseItem, primarySources, contextSources));
  }

  // Derive safe, non-empty wording from the new wizard fields + source
  // intelligence (the legacy targetAudience/industry/goals are blank now).
  const { title } = caseItem;
  const siTopics = primarySources.flatMap(sourceTopics);
  const targetAudience = caseAudience(caseItem);
  const industry = caseSector(caseItem, siTopics);
  const goals = caseGoalText(caseItem);
  const entities = sourceEntities(primarySources);
  const keywords = topicFromTitle(title);
  const primaryCount = primarySources.length;
  const contextCount = contextSources.length;

  const context: ResearchContext = {
    runId:    run.id,
    caseId:   caseItem.id,
    language: 'en',

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
      entities.length > 0
        ? `Key players referenced: ${entities.slice(0, 4).join(', ')}.`
        : `Source intelligence across ${primaryCount} primary source${primaryCount !== 1 ? 's' : ''} reveals consistent patterns.`,
      `The content goal — ${goals.length > 80 ? goals.slice(0, 80) + '…' : goals} — is well-supported by the evidence.`,
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
  // Hebrew output uses the dedicated Hebrew mock builder (Phase 8.6).
  if (resolveOutputLang(run, caseItem) === 'he') {
    return ContentPackageSchema.parse(hebrewContentPackage(caseItem, researchContext, factCheckReport));
  }

  // Derive safe, non-empty wording from the new wizard fields (legacy
  // targetAudience/industry/writingStyle/goals are blank under the new wizard).
  const { title } = caseItem;
  const targetAudience = caseAudience(caseItem);
  const industry = caseSector(caseItem, researchContext.mainTopics);
  const writingStyle = caseStyleText(caseItem);
  const goals = caseGoalText(caseItem);
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
    callToAction: `Ready to act on these insights? Reply to this email with your thoughts — we read every response.`,
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
    closing: `Thanks for listening. We'll be back next week with more insights for ${targetAudience}. Until then, take care.`,
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

// ── Hebrew mock builders (Phase 8.6) ─────────────────────────────────────────
// Temporary Hebrew mock copy until the Claude Content Generator replaces the
// mock. Produces real Hebrew text (not English rendered RTL). Source-derived
// values (topics, claims, entities) may be Hebrew or English — mixed text is
// expected and acceptable.

function hebrewResearchContext(
  run: PipelineRun,
  caseItem: ContentCase,
  primarySources: ContentSource[],
  contextSources: ContentSource[],
): ResearchContext {
  const title = caseItem.title;
  const siTopics = primarySources.flatMap(sourceTopics);
  const entities = sourceEntities(primarySources);
  const primaryCount = primarySources.length;
  const contextCount = contextSources.length;
  const topic = siTopics[0] || topicFromTitle(title)[0] || title;
  const firstWord = title.split(/\s+/)[0] || title;

  const mainTopics = [
    `סקירת נוף בנושא ${topic}`,
    'התפתחויות ומגמות מרכזיות',
    'השלכות עבור הקהל',
    ...siTopics.slice(0, 3).map(t => `ניתוח ${t}`),
  ].filter((t, i, a) => a.indexOf(t) === i).slice(0, 5);

  const keyInsights = [
    `${topic} משנה את אופן הפעולה בתחום.`,
    'מאמצים מוקדמים כבר רואים תוצאות מדידות.',
    entities.length > 0
      ? `גורמים מרכזיים שהוזכרו: ${entities.slice(0, 4).join(', ')}.`
      : `מודיעין המקורות חושף דפוסים עקביים על פני ${primaryCount} מקורות.`,
    `המטרה — ${GOAL_PHRASES_HE[caseItem.contentGoal as unknown as string] ?? 'יעדי התוכן'} — נתמכת היטב בראיות.`,
  ].filter(Boolean).slice(0, 4);

  const importantClaims = primarySources
    .flatMap(s => {
      const claims = sourceClaims(s);
      return claims.length > 0 ? claims : [`מתוך "${s.label}": ${describeSource(s)}`];
    })
    .slice(0, Math.min(primaryCount * 2, 8));

  return {
    runId:    run.id,
    caseId:   caseItem.id,
    language: 'he',
    summary:
      `ניתוח מחקר עבור "${title}". עובדו ${primaryCount} מקורות עיקריים` +
      (contextCount > 0 ? ` ו-${contextCount} מקורות הקשר נוספים לשמירה על עקביות.` : '.'),
    mainTopics,
    keyInsights,
    importantClaims,
    suggestedAngles: [
      `זווית ה-ROI: כימות ההשפעה של ${topic}`,
      'ציר הזמן לאימוץ: לאן התחום מתקדם בשנה הקרובה',
      'זווית הסיכון: מה קורה אם לא פועלים עכשיו',
      'זווית חקר המקרה: ארגונים שכבר רואים תוצאות',
    ].slice(0, 4),
    suggestedHooks: [
      `מה אם אפשר היה להתקדם פי 10 מהר יותר עם ${topic}?`,
      'התחום נמצא בנקודת מפנה — והנה למה זה חשוב עבורכם.',
      `רובם לא מבינים כמה מהר ${firstWord} משתנה.`,
    ],
    sourceReferences: [
      ...primarySources.map(s => s.label || s.type),
      ...contextSources.map(s => `[הקשר] ${s.label || s.type}`),
    ],
    contradictions: contextCount > 0
      ? ['זוהו אי-התאמות קלות בין המקורות העיקריים להקשר ההיסטורי — סומנו לבדיקת עובדות.']
      : [],
    risks: [
      'יש לאמת טענות סטטיסטיות לפני פרסום.',
      'יש לוודא שטענות ספציפיות לתחום עדכניות במועד הפרסום.',
    ],
    confidenceScore: Math.min(95, avgConfidence(primarySources) + primaryCount * 2),
  };
}

function hebrewContentPackage(
  caseItem: ContentCase,
  rc: ResearchContext,
  fcr: FactCheckReport,
): ContentPackage {
  const title = caseItem.title;
  const hook = rc.suggestedHooks[0] ?? `כיצד ${title} משנה את התחום.`;
  const insight = rc.keyInsights[0] ?? `${title} משנה את התחום.`;
  const angle = rc.suggestedAngles[0] ?? `ההשפעה של ${title}.`;
  const topic = rc.mainTopics[0] ?? title;
  const hashtags = ['#תוכן', '#תובנות', '#AI'];

  const confidenceLine = fcr.overallConfidenceScore >= 90
    ? 'כל הטענות המרכזיות הוצלבו ואומתו.'
    : 'רוב הטענות אומתו; חלקן דורשות מקורות נוספים.';

  const strongLineRaw = rc.mainTopics[0]
    ? `${rc.mainTopics[0]} משנה הכול.`
    : `${title} משנה הכול.`;

  return {
    linkedin: {
      title,
      hook,
      body: [
        insight, '', angle, '',
        'מה זה אומר עבורכם:',
        rc.mainTopics.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n'),
        '', confidenceLine,
      ].join('\n').trim(),
      hashtags,
    },
    facebook: {
      title: `${title} — מה שחשוב לדעת`,
      body: [
        `עוקבים אחרי מה שקורה עם ${title}? 🚀`, '',
        insight, '',
        angle, '',
        `העמקנו בנושא ${topic} והתוצאות מרתקות.`, '',
        rc.keyInsights.slice(1, 3).map(i => `✅ ${i}`).join('\n'),
      ].join('\n'),
      callToAction: 'מה דעתכם? כתבו תגובה למטה או שתפו עם הרשת שלכם.',
      imagePromptRef: 'shared_social_image',
    },
    instagram: {
      strongLine: strongLineRaw.length > 120 ? strongLineRaw.slice(0, 117) + '…' : strongLineRaw,
      caption: [insight, '', `${angle} 👇`, '', hashtags.join(' ')].join('\n'),
      imagePromptRef: 'instagram_image',
    },
    newsletter: {
      subject: `${title}: מה משתנה ולמה זה חשוב`,
      previewText: insight.slice(0, 100),
      body: [
        'שלום רב,', '',
        `השבוע אנחנו מסקרים את ${title} — ולמה זה חשוב מתמיד.`, '',
        '## התמונה הגדולה', insight, '',
        '## מה מצאנו', rc.mainTopics.map(t => `**${t}**`).join('\n'), '',
        '## תובנות מרכזיות', rc.keyInsights.map(i => `- ${i}`).join('\n'), '',
        '## סיכום בדיקת עובדות',
        `בדקנו ${fcr.claimsChecked} טענות מהמקורות. ${fcr.verifiedClaims.length} אומתו ו-${fcr.uncertainClaims.length} סומנו לבדיקה נוספת.`,
      ].join('\n').trim(),
      callToAction: 'מוכנים לפעול על סמך התובנות? השיבו למייל הזה — אנחנו קוראים כל תגובה.',
    },
    podcast: {
      title: `${title} — צלילה לעומק`,
      intro: [
        `ברוכים הבאים לפרק היום. אנחנו מדברים על ${title}, ואני מבטיח שלא תרצו לפספס.`,
        insight,
        'היום נפרק את זה לגורמים ונבין מה זה אומר בפועל.',
      ].join(' '),
      segments: [
        {
          title: 'ההקשר',
          content: [`נתחיל מהתמונה הגדולה. ${rc.summary}`, `${topic} כבר כאן — זו אינה מגמה עתידית.`].join('\n\n'),
        },
        {
          title: 'הממצאים המרכזיים',
          content: ['הנה מה שהמחקר מראה:', rc.keyInsights.map((i, idx) => `נקודה ${idx + 1}: ${i}`).join('\n\n')].join('\n\n'),
        },
        {
          title: 'בדיקת העובדות',
          content: [
            `בדקנו ${fcr.claimsChecked} טענות מהמקורות.`,
            `- ${fcr.verifiedClaims.length} אומתו ברמת ביטחון גבוהה`,
            `- ${fcr.uncertainClaims.length} סומנו כלא ודאיות`,
          ].join('\n'),
        },
        {
          title: 'מה זה אומר עבורכם',
          content: [angle, 'ההשלכות המעשיות:', rc.suggestedAngles.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n')].join('\n\n'),
        },
      ],
      fullScript: [
        '[פתיח]', `ברוכים הבאים לפרק היום. אנחנו מדברים על ${title}.`, insight, '',
        '[הקשר]', rc.summary, '',
        '[ממצאים]', rc.keyInsights.map((i, idx) => `נקודה ${idx + 1}: ${i}`).join('\n\n'), '',
        '[בדיקת עובדות]', `בדקנו ${fcr.claimsChecked} טענות. ${fcr.verifiedClaims.length} אומתו. ${fcr.uncertainClaims.length} לא ודאיות.`, '',
        '[מה זה אומר]', angle, rc.suggestedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n'), '',
        '[סיום]', 'תודה שהאזנתם.',
      ].join('\n'),
      closing: 'תודה שהאזנתם. נשוב בשבוע הבא עם תובנות נוספות. עד אז, להתראות.',
    },
    images: {
      instagramImage: {
        prompt: `תמונת עריכה ריבועית המייצגת את ${title}. דגש על ${topic}. ויזואל חד ומושך לפיד אינסטגרם, קומפוזיציה נקייה ומטאפורה ויזואלית חזקה.`,
        aspectRatio: '1:1',
        visualStyle: 'אסתטיקה מודרנית ונקייה, פורמט ריבועי המותאם לאינסטגרם',
        mood: 'מקצועי, מעורר השראה ובולט ויזואלית',
        negativePrompt: 'מטושטש, עמוס, טקסט על התמונה, איכות נמוכה, סימני מים',
      },
      facebookLinkedinImage: {
        prompt: `תמונת עריכה רוחבית המייצגת את ${title} עבור רשתות מקצועיות. הקשר: ${topic}. קומפוזיציה רחבה המתאימה לפיד של פייסבוק ולינקדאין.`,
        aspectRatio: '1.91:1',
        visualStyle: 'אסתטיקה מודרנית ונקייה, פורמט רוחבי לשיתוף ברשתות',
        mood: 'מקצועי ואמין',
        negativePrompt: 'פורמט אנכי, מטושטש, טקסט על התמונה, איכות נמוכה, סימני מים',
      },
    },
  };
}

// ── Re-export schemas for use in pipelineService ─────────────────────────────

export { ResearchContextSchema, FactCheckReportSchema, ContentPackageSchema };
