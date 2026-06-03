import { z } from 'zod';

// PATCH /api/cases/:caseId/outputs/:outputId
export const updateOutputBodySchema = z.object({
  body:  z.string().min(1, 'Body cannot be empty'),
  title: z.string().optional(),
});

// PATCH /api/cases/:caseId/outputs/:outputId/status
export const updateOutputStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export type UpdateOutputBodyInput   = z.infer<typeof updateOutputBodySchema>;
export type UpdateOutputStatusInput = z.infer<typeof updateOutputStatusSchema>;
