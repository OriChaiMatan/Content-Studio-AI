import { Router } from 'express';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { contactSchema } from '../../schemas/contactSchema';
import { contactConfig } from '../../lib/contactConfig';
import { contactLimiter } from '../middleware/rateLimit';
import { emailService } from '../../services/emailService';

const router = Router();

// ── POST /api/contact ──────────────────────────────────────────────────────────
// Public marketing-site contact form. No auth. The destination is entirely
// env-driven (CONTACT_TO_EMAIL) — never hardcode an address here or on the
// frontend. Unlike /auth/forgot-password this has no enumeration concern, so a
// genuine delivery failure is reported back to the visitor instead of hidden.
router.post('/', contactLimiter, async (req: Request, res: Response) => {
  try {
    const input = contactSchema.parse(req.body);

    if (!contactConfig.enabled) {
      console.error('[POST /api/contact] CONTACT_TO_EMAIL is not configured');
      res.status(500).json({ error: 'The contact form is not available right now. Please try again later.' });
      return;
    }

    const result = await emailService.sendContactMessage({
      to: contactConfig.toEmail,
      name: input.name,
      email: input.email,
      message: input.message,
    });

    // `disabled` means no email provider key is configured (e.g. local dev without
    // RESEND_API_KEY) — a normal, expected state, not a delivery failure. Log so a
    // developer testing locally can confirm the submission was processed, and
    // report success since the endpoint did everything it could with what's
    // configured. A real provider `error` (key present, send failed) IS reported
    // back — the visitor deserves to know their message wasn't delivered.
    if (!result.sent && result.reason === 'disabled') {
      console.warn(`[POST /api/contact] (no email provider configured) message from ${input.name} <${input.email}>: ${input.message}`);
    } else if (!result.sent) {
      res.status(502).json({ error: 'We could not send your message right now. Please try again or email us directly.' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.errors[0]?.message ?? 'Please check your details and try again.', details: err.errors });
      return;
    }
    console.error('[POST /api/contact]', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
