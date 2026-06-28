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

// Thesis Discipline (Phase 10C): forces the angle to be argued at analyst level.
// NOT fact-check (truth on the internet) — it asks "even if the facts are true,
// is our conclusion the best explanation, and how strongly may we state it?".
const StrengthEnum = z.enum(['strong', 'moderate', 'weak']);
export const ThesisDisciplineSchema = z.object({
  supportLevel: StrengthEnum,                          // overall: how well the sources back the thesis
  supportingEvidence: z.array(z.object({
    claim:      z.string().min(1),
    sourceRefs: z.array(z.string().min(1)).min(0),
    strength:   StrengthEnum,
  })).min(0),
  assumptions: z.array(z.object({
    assumption:  z.string().min(1),
    whyItMatters: z.string().min(1),
    riskIfWrong:  z.string().min(1),
  })).min(0),
  counterArguments: z.array(z.object({
    argument:   z.string().min(1),
    sourceRefs: z.array(z.string().min(1)).min(0).optional(),
    strength:   StrengthEnum,
  })).min(0),
  alternativeExplanations: z.array(z.object({
    explanation: z.string().min(1),
    whyPlausible: z.string().min(1),
  })).min(0),
  overreachWarnings: z.array(z.object({
    riskyClaim:  z.string().min(1),
    saferWording: z.string().min(1),
    reason:       z.string().min(1),
  })).min(0),
  wordingGuidance: z.object({
    allowedStrength:    z.enum(['assertive', 'balanced', 'cautious', 'speculative']),
    requiredQualifiers: z.array(z.string()).min(0),
    forbiddenPhrases:   z.array(z.string()).min(0),
  }),
});
export type ThesisDiscipline = z.infer<typeof ThesisDisciplineSchema>;

// Thesis Competition (Phase 10D): generate multiple candidate theses, score them,
// and select the winner — so the system behaves like a world-class editor (picks
// the STRONGEST explanation) rather than a cautious analyst (picks the safest).
export const ThesisScoresSchema = z.object({
  novelty:             z.number().int().min(0).max(10),
  explanatoryPower:    z.number().int().min(0).max(10),
  crossSourceCoverage: z.number().int().min(0).max(10),
  discussionPotential: z.number().int().min(0).max(10),
  businessValue:       z.number().int().min(0).max(10),
  strategicDepth:      z.number().int().min(0).max(10),
});
export type ThesisScores = z.infer<typeof ThesisScoresSchema>;

// Editorial scores (Phase 10D.1): the STORY axis, orthogonal to the analytical
// axis above. Editorial power = make a serious reader stop, care, grasp the
// stakes, and remember the thesis — NOT clickbait / tabloid / rage-bait.
export const EditorialScoresSchema = z.object({
  readerCuriosity: z.number().int().min(0).max(10),   // want to keep reading?
  reframeStrength: z.number().int().min(0).max(10),   // overturns the default assumption?
  narrativeTension:z.number().int().min(0).max(10),   // conflict / paradox / irony / tradeoff / unresolved stakes?
  headlinePower:   z.number().int().min(0).max(10),   // plausible top-tier headline (Economist/Bloomberg/Stratechery/HBR)?
});
export type EditorialScores = z.infer<typeof EditorialScoresSchema>;

export const CandidateAngleSchema = z.object({
  thesis:     z.string().min(1),
  reframe:    z.string().min(1),
  grounding:  z.enum(['factual', 'inferred', 'speculative']),
  sourceRefs: z.array(z.string().min(1)).min(0),
  rationale:  z.string().min(1),    // why it explains the evidence
  // ≥1 required of a winner: explains-unrelated | hidden-driver | reframes-topic.
  qualifyingProperties: z.array(z.enum(['explains-unrelated', 'hidden-driver', 'reframes-topic'])).min(0),
  scores:       ThesisScoresSchema,
  overallValue: z.number().min(0).max(10),   // computed analytical weighted total
  // Phase 10D.1 — editorial axis (optional: absent on pre-10D.1 / degraded runs).
  editorialScores: EditorialScoresSchema.optional(),
  editorialValue:  z.number().min(0).max(10).optional(),   // computed mean of editorial dims
});
export type CandidateAngle = z.infer<typeof CandidateAngleSchema>;

export const ThesisCompetitionSchema = z.object({
  candidates:         z.array(CandidateAngleSchema).min(1),
  winnerIndex:        z.number().int().min(0),                 // the FINAL (editorial) winner
  runnerUpIndex:      z.number().int().min(0).optional(),
  reasonForSelection: z.string().min(1),
  reasonOthersLost:   z.string().min(0),
  // Phase 10D.1 — two-stage funnel diagnostics (optional for back-compat).
  finalists:             z.array(z.number().int().min(0)).optional(),
  analyticalWinnerIndex: z.number().int().min(0).optional(),
  editorialWinnerIndex:  z.number().int().min(0).optional(),
  editorialReason:       z.string().optional(),
});
export type ThesisCompetition = z.infer<typeof ThesisCompetitionSchema>;

// Primary Angle (Phase 10B): the single narrative spine the generators build
// around. Authored once at research-finalize time, persisted in the synthesis
// layer, projected into every platform's GeneratorInput. grounding sets the
// wording register (assert/hedge/speculate) — an uncertain pillar changes HOW
// the thesis is stated, never whether it is the spine.
export const PrimaryAngleSchema = z.object({
  thesis:    z.string().min(1),   // the one-sentence narrative spine, in output language
  reframe:   z.string().min(1),   // the "the real story is X, not Y" hook seed
  kind:      z.enum(['connection', 'tension', 'contradiction', 'insight', 'implication', 'single-source-insight']),
  grounding: z.enum(['factual', 'inferred', 'speculative']),
  synthesisBasis: z.object({
    sourceRefs: z.array(z.string().min(1)).min(0),
    excerpt:    z.string().min(1),
  }),
  tensionPoles: z.object({ a: z.string().min(1), b: z.string().min(1) }).optional(),
  expertPOV:    ExpertPOVSchema.optional(),
  supportingFacts: z.array(z.string()).min(0),
  uncertaintyHandling: z.object({
    register:     z.enum(['assert', 'hedge', 'speculate']),
    hedgedClaims: z.array(z.string()).min(0),
  }),
  confidence: z.number().int().min(0).max(100),
  thesisDiscipline: ThesisDisciplineSchema.optional(),   // Phase 10C
});
export type PrimaryAngle = z.infer<typeof PrimaryAngleSchema>;

export const ResearchSynthesisLayerSchema = z.object({
  mainStory:                StorySchema,
  supportingStories:        z.array(StorySchema).min(0),
  sourceConnections:        z.array(SourceConnectionSchema).min(0),
  tensions:                 z.array(TensionSchema).min(0),
  contradictions:           z.array(SynthesisContradictionSchema).min(0),
  secondOrderImplications:  z.array(ImplicationSchema).min(0),
  nonObviousInsights:       z.array(NonObviousInsightSchema).min(0),
  openQuestions:            z.array(z.string().min(1)).min(0),
  primaryAngle:             PrimaryAngleSchema.optional(),       // Phase 10B (the winning thesis)
  thesisCompetition:        ThesisCompetitionSchema.optional(),  // Phase 10D (selection diagnostics)
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
//   LinkedIn 0–3 · Facebook 0–2.
// Image prompts are embedded only in LinkedIn / Facebook.
// Newsletter & Podcast have no image prompt.
// ═════════════════════════════════════════════════════════════════════════════

// Podcast retired from the active MVP (deferred, like Instagram & image generation).
// Legacy podcast outputs in the DB still render; the platform is no longer generated.
export const CONTENT_PLATFORMS = ['linkedin', 'facebook', 'newsletter'] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const LinkedInBreakdownSchema = z.object({
  hook:        z.string().min(1),
  context:     z.string().min(1),
  insight:     z.string().min(1),
  // Phase L2 — takeaways are now OPTIONAL (0–3): sharp implications/consequences of
  // the thesis, NOT a required "lessons" list. max kept permissive; the LinkedIn
  // finalizer caps to 3. (LinkedIn only — Facebook/Newsletter/Podcast unchanged.)
  takeaways:   z.array(z.string().min(1)).min(0).max(6),
  cta:         z.string().min(1),
  // Phase L3 — LinkedIn hashtags are mandatory 3–6 (delivered by the finalizer's
  // deterministic backfill). Schema keeps min permissive so a rare backfill shortage
  // never rejects the whole post; max raised 3 → 6.
  hashtags:    z.array(z.string().min(1)).min(0).max(6),
});

export const FacebookBreakdownSchema = z.object({
  hook:                   z.string().min(1),
  story:                  z.string().min(1),
  personalInterpretation: z.string().min(1),
  communityQuestion:      z.string().min(1),
  hashtags:               z.array(z.string().min(1)).min(0).max(2),   // 0–2
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

// Thesis Preservation Score (Phase 10E.2) — deterministic post-generation measure
// of how much of the winning primaryAngle survives into the final content.
export const ThesisPreservationSchema = z.object({
  score:              z.number().int().min(0).max(100),
  thesisPresence:     z.number().int().min(0).max(100),
  spinePosition:      z.number().int().min(0).max(100),
  crossSource:        z.number().int().min(0).max(100),
  editorialSharpness: z.number().int().min(0).max(100),
  registerFidelity:   z.number().int().min(0).max(100),
  nonFlattening:      z.number().int().min(0).max(100),
});
export type ThesisPreservation = z.infer<typeof ThesisPreservationSchema>;

export const ContentMetadataSchema = z.object({
  generatorVersion:         z.string().min(1),        // "mock-2" | "gen-1" | "mock-fallback"
  model:                    z.string().optional(),
  degraded:                 z.boolean().default(false),
  thesisPreservation:       ThesisPreservationSchema.optional(),   // Phase 10E.2
  // Phase 10D.0 — input-degradation propagation. True when the RESEARCH stage
  // this content was built on fell back to mock (even if the generator itself
  // succeeded as claude-gen-1). Surfaced as a distinct "degraded research" badge.
  researchDegraded:         z.boolean().optional(),
  researchGeneratorVersion: z.string().optional(),    // "research-1" | "mock-research" | "mock-fallback"
  contentScore:             z.number().int().min(0).max(100).nullable().optional(),
  researchConfidence:       z.number().int().min(0).max(100).nullable().optional(),
  factCheckAccuracy:        z.number().int().min(0).max(100).nullable().optional(),
  hashtags:                 z.array(z.string()).optional(),
  readingTimeMinutes:       z.number().nullable().optional(),       // newsletter
  practicalTakeawaysRepaired: z.boolean().optional(),               // Phase 11D.3 — empty required array backfilled deterministically (no Claude retry)
  linkedinLengthRepaired:   z.boolean().optional(),                 // Phase 11D.4 — assembled post trimmed to ≤1400 deterministically (no Claude retry)
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
  z.object({ platform: z.literal('newsletter'), breakdown: NewsletterBreakdownSchema, ...baseOutputShape }),
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
    // Phase 10D.0 — degradation of the upstream research, carried so the
    // generator can stamp it onto every output's metadata.
    researchDegraded:         z.boolean().default(false),
    researchGeneratorVersion: z.string().optional(),
  }),
  brief: z.object({
    caseTitle:    z.string().min(1),
    contentGoal:  z.string().min(1),
    goalCustom:   z.string().optional(),
    contentStyle: z.string().min(1),
    styleCustom:  z.string().optional(),
    // Phase 1 (voice-aware generation) — user-defined voice settings that already
    // exist on the case but were never plumbed to the generator. All optional:
    // empty/blank cases simply omit them from the rendered prompt.
    targetAudience: z.string().optional(),
    writingStyle:   z.string().optional(),
    goals:          z.string().optional(),
    language:       z.string().optional(),
    aiInstructions: z.string().optional(),
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
    primaryAngle:    PrimaryAngleSchema.optional(),   // Phase 10B — the narrative spine
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
