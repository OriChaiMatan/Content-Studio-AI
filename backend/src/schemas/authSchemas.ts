import { z } from 'zod';

// Phase 12 — auth request validation.
export const registerSchema = z.object({
  name:     z.string().trim().min(1, 'Name is required').max(120),
  email:    z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput    = z.infer<typeof loginSchema>;
