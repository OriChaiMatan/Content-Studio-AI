import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// AI Pipeline Contract Schemas
//
// Each schema defines the exact shape that real AI must produce in Phase 8.
// The mock service (mockAiService.ts) follows these schemas exactly so the
// swap from mock → real AI only requires replacing the generator, not the
// validation, persistence, or UI layers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stage 1: Research Context ─────────────────────────────────────────────────

export const ResearchContextSchema = z.object({
  runId:             z.string().min(1),
  caseId:            z.string().min(1),
  language:          z.enum(['en', 'he']),
  summary:           z.string().min(10),
  mainTopics:        z.array(z.string().min(1)).min(1).max(10),
  keyInsights:       z.array(z.string().min(1)).min(1).max(10),
  importantClaims:   z.array(z.string().min(1)).min(0).max(15),
  suggestedAngles:   z.array(z.string().min(1)).min(1).max(6),
  suggestedHooks:    z.array(z.string().min(1)).min(1).max(5),
  sourceReferences:  z.array(z.string()).min(0),
  contradictions:    z.array(z.string()).min(0),
  risks:             z.array(z.string()).min(0),
  confidenceScore:   z.number().int().min(0).max(100),
});

export type ResearchContext = z.infer<typeof ResearchContextSchema>;

// ── Stage 1 v2: Research Synthesis (Phase 10A) ────────────────────────────────
// Superset of ResearchContextSchema: keeps EVERY v1 field (so existing consumers —
// fact_check, content_creation, generatorInput — keep parsing it as v1) and adds
// real cross-source synthesis layers. The synthesis service maps the v2 layers
// DOWN into the v1 fields, so v1 consumers benefit with no changes.

const GroundingEnum = z.enum(['supported', 'inferred', 'speculative']);

export const CoreSubjectSchema = z.object({
  name:       z.string().min(1),
  type:       z.enum(['company', 'person', 'product', 'technology', 'concept', 'trend', 'organization', 'location']),
  role:       z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
});

export const KeyFactSchema = z.object({
  statement:  z.string().min(1),
  type:       z.enum(['announcement', 'statistic', 'claim', 'definition', 'event', 'opinion', 'prediction']),
  sourceRefs: z.array(z.string().min(1)).min(1),
  grounding:  z.enum(['stated', 'implied']),
  status:     z.enum(['claimed', 'corroborated', 'disputed', 'unverified']),
  confidence: z.number().int().min(0).max(100),
});

export const StorySchema = z.object({
  headline:   z.string().min(1),
  summary:    z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(0),
});

export const SourceConnectionSchema = z.object({
  description: z.string().min(1),
  sourceRefs:  z.array(z.string().min(1)).min(1),   // ≥2 enforced at top level unless singleSource
  type:        z.enum(['causal', 'analogical', 'sequential', 'tension', 'convergent', 'enabling']),
  novelty:     z.number().int().min(0).max(100),
  confidence:  z.number().int().min(0).max(100),
  grounding:   GroundingEnum,
});

export const TensionSchema = z.object({
  description: z.string().min(1),
  poles:       z.array(z.string().min(1)).length(2),
  sourceRefs:  z.array(z.string().min(1)).min(0),
});

export const SynthesisContradictionSchema = z.object({
  subject:    z.string().min(1),
  claimA:     z.string().min(1),
  claimB:     z.string().min(1),
  sourceRefs: z.array(z.string().min(1)).min(0),
  nature:     z.enum(['factual', 'evidentiary', 'scope']),
  severity:   z.number().int().min(0).max(100),
  resolution: z.string().min(1),
});

export const ImplicationSchema = z.object({
  implication: z.string().min(1),
  basis:       z.array(z.string().min(1)).min(0),
  horizon:     z.enum(['now', 'near', 'long']),
  confidence:  z.number().int().min(0).max(100),
  speculative: z.boolean(),
});

// expertPOV (Phase 10A addition): the conclusion a domain expert would draw.
// NEVER a fact — grounding is restricted to inferred/speculative.
export const ExpertPOVSchema = z.object({
  type:      z.enum(['strategic', 'operational', 'prediction', 'practitioner']),
  statement: z.string().min(1),
  grounding: z.enum(['inferred', 'speculative']),
});

export const NonObviousInsightSchema = z.object({
  insight:     z.string().min(1),
  reasoning:   z.string().min(1),
  sourceRefs:  z.array(z.string().min(1)).min(0),
  novelty:     z.number().int().min(0).max(100),
  lens:        z.enum(['analogical', 'second-order', 'contrarian', 'absence', 'stakeholder']),
  speculative: z.boolean(),
  expertPOV:   ExpertPOVSchema.optional(),
});

export const ResearchMetaSchema = z.object({
  sourceCount:         z.number().int().min(0),
  primarySourceCount:  z.number().int().min(0),
  contextSourceCount:  z.number().int().min(0),
  synthesisConfidence: z.number().int().min(0).max(100),
  singleSource:        z.boolean(),
  generatorVersion:    z.string().min(1),   // "research-1" | "mock-research" | "mock-fallback"
  degraded:            z.boolean(),
  sourceRefMap:        z.array(z.object({
    ref:      z.string().min(1),
    sourceId: z.string().min(1),
    label:    z.string(),
    role:     z.enum(['primary', 'context']),
  })).min(0),
});

export const ResearchSynthesisLayerSchema = z.object({
  mainStory:                StorySchema,
  supportingStories:        z.array(StorySchema).min(0),
  sourceConnections:        z.array(SourceConnectionSchema).min(0),
  tensions:                 z.array(TensionSchema).min(0),
  contradictions:           z.array(SynthesisContradictionSchema).min(0),
  secondOrderImplications:  z.array(ImplicationSchema).min(0),
  nonObviousInsights:       z.array(NonObviousInsightSchema).min(0),
  openQuestions:            z.array(z.string().min(1)).min(0),
});

export const ResearchKnowledgeLayerSchema = z.object({
  coreSubjects: z.array(CoreSubjectSchema).min(0),
  keyFacts:     z.array(KeyFactSchema).min(0),
  timeline:     z.array(z.object({ when: z.string().min(1), event: z.string().min(1), sourceRefs: z.array(z.string()).min(0) })).min(0).optional(),
});

export const ResearchContextV2Schema = ResearchContextSchema.extend({
  meta:      ResearchMetaSchema,
  knowledge: ResearchKnowledgeLayerSchema,
  synthesis: ResearchSynthesisLayerSchema,
}).superRefine((rc, ctx) => {
  // A real cross-source connection must cite ≥2 sources — unless single-source.
  if (!rc.meta.singleSource) {
    rc.synthesis.sourceConnections.forEach((c, i) => {
      if (c.sourceRefs.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['synthesis', 'sourceConnections', i, 'sourceRefs'],
          message: 'A multi-source connection must reference at least 2 sources.' });
      }
    });
  }
});

export type ResearchContextV2 = z.infer<typeof ResearchContextV2Schema>;

// ── Stage 2: Fact Check Report ────────────────────────────────────────────────

export const FactCheckClaimStatusSchema = z.enum(['verified', 'uncertain', 'conflicting', 'unsupported']);
export type FactCheckClaimStatus = z.infer<typeof FactCheckClaimStatusSchema>;

export const FactCheckClaimSchema = z.object({
  claim:              z.string().min(1),
  status:             FactCheckClaimStatusSchema,
  confidenceScore:    z.number().int().min(0).max(100),
  supportingSources:  z.array(z.string()).min(0),
  notes:              z.string(),
});

export type FactCheckClaim = z.infer<typeof FactCheckClaimSchema>;

export const FactCheckReportSchema = z.object({
  runId:                   z.string().min(1),
  caseId:                  z.string().min(1),
  claimsChecked:           z.number().int().min(0),
  verifiedClaims:          z.array(FactCheckClaimSchema).min(0),
  uncertainClaims:         z.array(FactCheckClaimSchema).min(0),
  conflictingClaims:       z.array(FactCheckClaimSchema).min(0),
  warnings:                z.array(z.string()).min(0),
  overallConfidenceScore:  z.number().int().min(0).max(100),
  sourceReferences:        z.array(z.string()).min(0),
});

export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;

// ── Stage 3: Content Package ──────────────────────────────────────────────────

// LinkedIn
export const LinkedInContentSchema = z.object({
  title:     z.string().min(1),
  hook:      z.string().min(1),
  body:      z.string().min(10),
  hashtags:  z.array(z.string().min(1)).min(2).max(10),
});
export type LinkedInContent = z.infer<typeof LinkedInContentSchema>;

// Facebook
export const FacebookContentSchema = z.object({
  title:          z.string().min(1),
  body:           z.string().min(10),
  callToAction:   z.string().min(1),
  imagePromptRef: z.string().min(1),
});
export type FacebookContent = z.infer<typeof FacebookContentSchema>;

// Instagram
export const InstagramContentSchema = z.object({
  strongLine:     z.string().min(1).max(120), // short, punchy
  caption:        z.string().min(10),
  imagePromptRef: z.string().min(1),
});
export type InstagramContent = z.infer<typeof InstagramContentSchema>;

// Newsletter
export const NewsletterContentSchema = z.object({
  subject:        z.string().min(1),
  previewText:    z.string().min(1),
  body:           z.string().min(50),
  callToAction:   z.string().min(1),
});
export type NewsletterContent = z.infer<typeof NewsletterContentSchema>;

// Podcast
export const PodcastSegmentSchema = z.object({
  title:   z.string().min(1),
  content: z.string().min(10),
});
export type PodcastSegment = z.infer<typeof PodcastSegmentSchema>;

export const PodcastContentSchema = z.object({
  title:      z.string().min(1),
  intro:      z.string().min(10),
  fullScript: z.string().min(50),
  segments:   z.array(PodcastSegmentSchema).min(2).max(8),
  closing:    z.string().min(10),
});
export type PodcastContent = z.infer<typeof PodcastContentSchema>;

// Image Prompts
export const ImagePromptSchema = z.object({
  prompt:         z.string().min(10),
  aspectRatio:    z.string().min(1),   // "1:1" | "1.91:1"
  visualStyle:    z.string().min(1),
  mood:           z.string().min(1),
  negativePrompt: z.string().min(1),
});
export type ImagePrompt = z.infer<typeof ImagePromptSchema>;

export const ImagePromptsSchema = z.object({
  instagramImage:         ImagePromptSchema,  // 1:1 square
  facebookLinkedinImage:  ImagePromptSchema,  // 1.91:1 landscape
});
export type ImagePrompts = z.infer<typeof ImagePromptsSchema>;

// ── Source Intelligence (Phase 8) ─────────────────────────────────────────────
// Answers "what is this source saying?" — never verification or credibility.
// Generated by the Claude Source Analysis Agent, or the deterministic mock
// fallback. Validated against this schema regardless of which produced it.

// A structured assertion the source makes. Pre-shaped for Phase 9 verification.
export const ClaimSchema = z.object({
  text:                 z.string().min(1),
  type:                 z.enum(['announcement', 'statistic', 'prediction', 'opinion', 'definition']),
  subject:              z.string().optional(),       // links to an entity name when applicable
  verifiable:           z.boolean(),
  extractionConfidence: z.number().int().min(0).max(100),
  verificationStatus:   z.enum(['unverified']).default('unverified'), // Phase 8 always 'unverified'
});
export type Claim = z.infer<typeof ClaimSchema>;

// A named entity referenced by the source.
export const EntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['company', 'person', 'product', 'technology', 'location', 'organization']),
});
export type Entity = z.infer<typeof EntitySchema>;

export const SourceIntelligenceSchema = z.object({
  summary:                 z.string().min(1),
  mainTopics:              z.array(z.string().min(1)).min(1).max(10),
  keywords:                z.array(z.string().min(1)).min(1).max(10),
  claims:                  z.array(ClaimSchema).min(0).max(10),
  entities:                z.array(EntitySchema).min(0).max(20),
  sentiment:               z.enum(['positive', 'negative', 'neutral', 'mixed']),
  importanceScore:         z.number().int().min(0).max(100),
  contentAngles:           z.array(z.string().min(1)).min(0).max(6),
  language:                z.string().min(1),         // detected source language, e.g. "en"
  analysisConfidenceScore: z.number().int().min(0).max(100),
  analysisVersion:         z.string().min(1),          // "mock-2" | "claude-1" | "mock-fallback"
  truncated:               z.boolean(),
  analyzedAt:              z.string().min(1),          // ISO timestamp
});

export type SourceIntelligence = z.infer<typeof SourceIntelligenceSchema>;

// ── Content Package ───────────────────────────────────────────────────────────

export const ContentPackageSchema = z.object({
  linkedin:    LinkedInContentSchema,
  facebook:    FacebookContentSchema,
  instagram:   InstagramContentSchema,
  newsletter:  NewsletterContentSchema,
  podcast:     PodcastContentSchema,
  images:      ImagePromptsSchema,
});
export type ContentPackage = z.infer<typeof ContentPackageSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// Phase 9 — Content Generator v2
//
// ContentOutput v2 = readyToPublish (editable) + breakdown (read-only,
// platform-specific) + metadata. Hashtag bounds per product decision:
//   LinkedIn 0–3 · Facebook 0–2 · Instagram 5–8.
// Image prompts are embedded only in LinkedIn / Facebook / Instagram.
// Newsletter & Podcast have no image prompt.
// ═════════════════════════════════════════════════════════════════════════════

export const CONTENT_PLATFORMS = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast'] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const ImagePromptV2Schema = z.object({
  role:           z.enum(['primary', 'alternative']),
  prompt:         z.string().min(10),
  aspectRatio:    z.string().min(1),
  visualStyle:    z.string().min(1),
  mood:           z.string().min(1),
  negativePrompt: z.string().min(1),
});
export type ImagePromptV2 = z.infer<typeof ImagePromptV2Schema>;

export const LinkedInBreakdownSchema = z.object({
  hook:        z.string().min(1),
  context:     z.string().min(1),
  insight:     z.string().min(1),
  takeaways:   z.array(z.string().min(1)).min(1).max(6),
  cta:         z.string().min(1),
  hashtags:    z.array(z.string().min(1)).min(0).max(3),   // 0–3
  imagePrompt: ImagePromptV2Schema,
});

export const FacebookBreakdownSchema = z.object({
  hook:                   z.string().min(1),
  story:                  z.string().min(1),
  personalInterpretation: z.string().min(1),
  communityQuestion:      z.string().min(1),
  hashtags:               z.array(z.string().min(1)).min(0).max(2),   // 0–2
  imagePrompt:            ImagePromptV2Schema,
});

export const InstagramBreakdownSchema = z.object({
  hook:                   z.string().min(1),
  body:                   z.string().min(1),
  cta:                    z.string().min(1),
  hashtags:               z.array(z.string().min(1)).min(5).max(8),   // 5–8
  primaryImagePrompt:     ImagePromptV2Schema,
  alternativeImagePrompt: ImagePromptV2Schema,
});

export const NewsletterBreakdownSchema = z.object({
  subject:            z.string().min(1),
  previewText:        z.string().min(1),
  opening:            z.string().min(1),
  mainAnalysis:       z.string().min(1),
  practicalTakeaways: z.array(z.string().min(1)).min(1).max(8),
  closingInsight:     z.string().min(1),
  cta:                z.string().min(1),
});

export const PodcastChapterSchema = z.object({
  title:   z.string().min(1),
  summary: z.string().min(1),
});

export const PodcastBreakdownSchema = z.object({
  title:              z.string().min(1),
  description:        z.string().min(1),
  chapters:           z.array(PodcastChapterSchema).min(1).max(12),
  openingHook:        z.string().min(1),
  background:         z.string().min(1),
  whatHappened:       z.string().min(1),
  whyItMatters:       z.string().min(1),
  biggerPicture:      z.string().min(1),
  whatMostPeopleMiss: z.string().min(1),
  practicalActions:   z.array(z.string().min(1)).min(1).max(10),
  closingThoughts:    z.string().min(1),
  cta:                z.string().min(1),
  fullScript:         z.string().min(50),
});

export const ContentMetadataSchema = z.object({
  generatorVersion:         z.string().min(1),        // "mock-2" | "gen-1" | "mock-fallback"
  model:                    z.string().optional(),
  degraded:                 z.boolean().default(false),
  contentScore:             z.number().int().min(0).max(100).nullable().optional(),
  researchConfidence:       z.number().int().min(0).max(100).nullable().optional(),
  factCheckAccuracy:        z.number().int().min(0).max(100).nullable().optional(),
  hashtags:                 z.array(z.string()).optional(),
  imagePrompts:             z.array(ImagePromptV2Schema).optional(),
  readingTimeMinutes:       z.number().nullable().optional(),       // newsletter
  estimatedDurationMinutes: z.number().nullable().optional(),       // podcast
  estimatedWordCount:       z.number().int().nullable().optional(), // podcast
});
export type ContentMetadata = z.infer<typeof ContentMetadataSchema>;

// One generated output, discriminated by platform.
const baseOutputShape = {
  title:          z.string().min(1),
  readyToPublish: z.string().min(1),
  metadata:       ContentMetadataSchema,
};
export const GeneratedOutputSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('linkedin'),   breakdown: LinkedInBreakdownSchema,   ...baseOutputShape }),
  z.object({ platform: z.literal('facebook'),   breakdown: FacebookBreakdownSchema,   ...baseOutputShape }),
  z.object({ platform: z.literal('instagram'),  breakdown: InstagramBreakdownSchema,  ...baseOutputShape }),
  z.object({ platform: z.literal('newsletter'), breakdown: NewsletterBreakdownSchema, ...baseOutputShape }),
  z.object({ platform: z.literal('podcast'),    breakdown: PodcastBreakdownSchema,    ...baseOutputShape }),
]);
export type GeneratedOutput = z.infer<typeof GeneratedOutputSchema>;

// ── Generator Input projection (what every generator receives) ────────────────
export const GeneratorInputSchema = z.object({
  contract: z.object({
    platform:         z.enum(CONTENT_PLATFORMS),
    outputLanguage:   z.enum(['en', 'he']),
    generatorVersion: z.string().min(1),
    runId:            z.string().min(1),
    caseId:           z.string().min(1),
  }),
  brief: z.object({
    caseTitle:    z.string().min(1),
    contentGoal:  z.string().min(1),
    goalCustom:   z.string().optional(),
    contentStyle: z.string().min(1),
    styleCustom:  z.string().optional(),
  }),
  research: z.object({
    summary:         z.string(),
    mainTopics:      z.array(z.string()).max(10),
    keyInsights:     z.array(z.string()).max(10),
    importantClaims: z.array(z.string()).max(8),
    suggestedAngles: z.array(z.string()).max(6),
    suggestedHooks:  z.array(z.string()).max(5),
    contradictions:  z.array(z.string()),
    risks:           z.array(z.string()),
    confidenceScore: z.number().int().min(0).max(100),
  }),
  facts: z.object({
    verified:    z.array(z.object({ claim: z.string(), confidenceScore: z.number().int().optional() })).max(15),
    uncertain:   z.array(z.object({ claim: z.string(), note: z.string().optional() })).max(10),
    conflicting: z.array(z.string()),
    warnings:    z.array(z.string()),
    overallConfidenceScore: z.number().int().min(0).max(100),
  }),
  sources: z.object({
    entities:      z.array(z.object({ name: z.string(), type: z.string() })).max(20),
    keywords:      z.array(z.string()).max(15),
    sentiment:     z.enum(['positive', 'negative', 'neutral', 'mixed']),
    contentAngles: z.array(z.string()).max(6),
    sourceCount:   z.number().int().min(0),
  }),
  policy: z.object({
    factDiscipline:     z.literal('only-provided-facts'),
    unverifiedHandling: z.literal('hedge-or-omit'),
    forbidConflicting:  z.literal(true),
    languageStrict:     z.boolean(),
    noFabricatedStats:  z.literal(true),
  }),
  platformConfig: z.record(z.unknown()),
});
export type GeneratorInput = z.infer<typeof GeneratorInputSchema>;
