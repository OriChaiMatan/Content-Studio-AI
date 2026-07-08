import { z } from 'zod';

// Public marketing-site contact form. No auth, so keep limits tight enough to
// discourage abuse (paired with contactLimiter) while allowing a real message.
export const contactSchema = z.object({
  name:    z.string().trim().min(1, 'Name is required').max(120),
  email:   z.string().trim().toLowerCase().email('A valid email is required'),
  message: z.string().trim().min(1, 'Message is required').max(5000),
});
