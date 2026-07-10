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

export const ScheduleFrequencyEnum = z.enum(['manual', 'daily', 'weekly', 'monthly']);

// Schedule config fields, shared by create + update (Phase 8.6 — restored).
// scheduleTime: "HH:MM"; dayOfWeek 0–6 (weekly); dayOfMonth 1–31 (monthly).
const scheduleFields = {
  scheduleFrequency:  ScheduleFrequencyEnum.optional(),
  scheduleTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').nullable().optional(),
  scheduleDayOfWeek:  z.number().int().min(0).max(6).nullable().optional(),
  scheduleDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
};

// ── Create case — 3-step wizard (Goal → Style+Targets → Schedule) ─────────────
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
  ...scheduleFields,
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
  // Schedule config (Phase 8.6)
  ...scheduleFields,
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

// ── Reactivate — optional swap for the Free-plan "archive current, reactivate
// this one" conflict flow. Absent = plain reactivate, subject to the normal
// active-case limit check.
export const reactivateCaseSchema = z.object({
  archiveCaseId: z.string().min(1).optional(),
});

export type ReactivateCaseInput = z.infer<typeof reactivateCaseSchema>;
