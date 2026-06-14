import { z } from 'zod';

// Phase 13B — strict E.164 (no libphonenumber): '+' then a non-zero country digit
// and 7–14 more digits. Local formats are rejected with a clear message.
const e164Phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid WhatsApp number in international format, e.g. +972501234567');

// Phase 12 — auth request validation.
export const registerSchema = z.object({
  name:          z.string().trim().min(1, 'Name is required').max(120),
  email:         z.string().trim().toLowerCase().email('A valid email is required'),
  password:      z.string().min(8, 'Password must be at least 8 characters').max(200),
  // Phase 13B — WhatsApp number collected at registration (verification is separate).
  whatsappPhone: e164Phone,
});

export const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Phase 13B — change the pending/verified WhatsApp number.
export const changeWhatsappNumberSchema = z.object({
  whatsappPhone: e164Phone,
});

export type RegisterInput             = z.infer<typeof registerSchema>;
export type LoginInput                = z.infer<typeof loginSchema>;
export type ChangeWhatsappNumberInput = z.infer<typeof changeWhatsappNumberSchema>;
