import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n/useT';
import { AuthLayout, AuthField } from './AuthLayout';

// Forgot Password — request a reset link. Reuses the editorial AuthLayout/AuthField.
// The backend always returns the same generic response, so on success we show the exact
// same message whether or not the email exists (no account enumeration).
export function ForgotPasswordPage() {
  const forgotPassword = useAuthStore(s => s.forgotPassword);
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      // The endpoint never leaks existence; the only errors here are transport/rate-limit.
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <header className="space-y-1">
        <h2 className="font-serif text-[32px] leading-10 text-on-surface">{t('auth.forgotTitle')}</h2>
        <p className="text-[14px] text-on-surface-variant">{t('auth.forgotSubtitle')}</p>
      </header>

      {submitted ? (
        <div className="space-y-6" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <Icon name="mark_email_read" size="sm" className="mt-0.5 text-primary" />
            <p className="text-[14px] leading-6 text-on-surface">{t('auth.forgotSuccess')}</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-primary hover:underline underline-offset-4">
            <Icon name="arrow_back" size="sm" /> {t('auth.backToSignIn')}
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-lg">
            <AuthField
              id="email" label={t('auth.email')} type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} placeholder="name@organization.com"
            />
            {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
            <Button type="submit" fullWidth loading={busy} className="rounded-lg py-3">
              {t('auth.forgotCta')} <Icon name="arrow_forward" size="sm" />
            </Button>
          </form>

          <p className="text-[14px] text-on-surface-variant">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline underline-offset-4">
              <Icon name="arrow_back" size="sm" /> {t('auth.backToSignIn')}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
