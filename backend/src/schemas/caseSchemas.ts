import { z } from 'zod';

// ── Shared enums ──────────────────────────────────────────────────────────────

export const ContentGoalEnum = z.enum([
  'build_authority', 'generate_leads', 'increase_sales',
  'educate_audience', 'grow_community', 'personal_branding', 'other',
]);

export const ContentStyleEnum = z.enum([
  'professional', 'authoritative', 'friendly', 'personal',
  'journalistic', 'provocative', 'humorous', 'other',
]);

// Target values as stored in DB; 'images' maps to 'image_prompt' platform
export const ContentTargetEnum = z.enum([
  'linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'images',
]);

// ── Create case — simplified 3-step wizard ────────────────────────────────────
// No sources, no schedule, no audience/industry/style text in creation.

export const createCaseSchema = z.object({
  title:          z.string().min(1, 'Case title is required').max(200),
  contentGoal:    ContentGoalEnum.default('build_authority'),
  goalCustom:     z.string().default(''),
  contentStyle:   ContentStyleEnum.default('professional'),
  styleCustom:    z.string().default(''),
  language:       z.enum(['en', 'he']).default('en'),
  contentTargets: z
    .array(ContentTargetEnum)
    .min(1, 'At least one content target must be selected'),
});

// ── Update case — all fields optional for inline editing ─────────────────────

export const updateCaseSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  language:       z.enum(['en', 'he']).optional(),
  contentGoal:    ContentGoalEnum.optional(),
  goalCustom:     z.string().optional(),
  contentStyle:   ContentStyleEnum.optional(),
  styleCustom:    z.string().optional(),
  contentTargets: z
    .array(ContentTargetEnum)
    .min(1, 'At least one content target must be selected')
    .optional(),
  // Legacy fields — kept for backward compat with old wizard-created cases
  targetAudience:  z.string().optional(),
  industry:        z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  writingStyle:    z.string().optional(),
  goals:           z.string().optional(),
  aiInstructions:  z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
