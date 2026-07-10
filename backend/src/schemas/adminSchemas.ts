import { z } from 'zod';

export const updateUserPlanSchema = z
  .object({
    plan: z.enum(['FREE', 'PRO']).optional(),
    planStatus: z.enum(['ACTIVE', 'CANCELED', 'PAST_DUE', 'SUSPENDED', 'TRIAL']).optional(),
  })
  .refine(data => data.plan !== undefined || data.planStatus !== undefined, {
    message: 'Provide plan and/or planStatus.',
  });

export type UpdateUserPlanInput = z.infer<typeof updateUserPlanSchema>;
