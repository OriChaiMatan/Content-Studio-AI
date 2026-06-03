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

// Full Content Package
export const ContentPackageSchema = z.object({
  linkedin:    LinkedInContentSchema,
  facebook:    FacebookContentSchema,
  instagram:   InstagramContentSchema,
  newsletter:  NewsletterContentSchema,
  podcast:     PodcastContentSchema,
  images:      ImagePromptsSchema,
});
export type ContentPackage = z.infer<typeof ContentPackageSchema>;
