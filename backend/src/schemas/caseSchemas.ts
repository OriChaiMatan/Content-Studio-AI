import { z } from 'zod';

const scheduleSchema = z.object({
  frequency: z.enum(['manual', 'daily', 'weekly', 'monthly']),
  time: z.string().nullable().default(null),
  dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
  dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
});

const sourceInputSchema = z.object({
  type: z.enum(['text', 'url', 'pdf']),
  label: z.string().default(''),
  content: z.string().min(1, 'Source content is required'),
});

export const createCaseSchema = z.object({
  title: z.string().min(1, 'Case title is required').max(200),
  language: z.enum(['en', 'he']).default('en'),
  targetAudience: z.string().default(''),
  industry: z.string().default(''),
  experienceLevel: z.enum(['beginner', 'intermediate', 'expert']).default('intermediate'),
  writingStyle: z.string().default(''),
  goals: z.string().default(''),
  aiInstructions: z.string().default(''),
  sources: z.array(sourceInputSchema).default([]),
  schedule: scheduleSchema.default({
    frequency: 'manual',
    time: null,
    dayOfWeek: null,
    dayOfMonth: null,
  }),
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  language: z.enum(['en', 'he']).optional(),
  targetAudience: z.string().optional(),
  industry: z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  writingStyle: z.string().optional(),
  goals: z.string().optional(),
  aiInstructions: z.string().optional(),
  schedule: scheduleSchema.optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
