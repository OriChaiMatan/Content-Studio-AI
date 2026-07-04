import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n/useT';
import { AuthLayout, AuthField } from './AuthLayout';

const MIN_LEN = 8;

// A Link styled to match the primary Button (which only renders a <button>).
const primaryLinkCls =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 active:scale-95';

// Reset Password — /reset-password?token=…  Three states: the form, a success panel, and
// a friendly "invalid/expired link" panel. Reuses the editorial AuthLayout/AuthField.
export function ResetPasswordPage() {
  const resetPassword = useAuthStore(s => s.resetPassword);
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  // A missing token can never succeed — start straight in the invalid state.
  const [view, setView] = useState<'form' | 'success' | 'invalid'>(token ? 'form' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) { setError(t('auth.passwordMin')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }

    setBusy(true);
    try {
      await resetPassword(token, password);
      setView('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setView('invalid');           // invalid / expired / already-used token
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (view === 'success') {
    return (
      <AuthLayout>
        <div className="space-y-6" role="status">
          <header className="flex items-start gap-3">
            <Icon name="check_circle" className="mt-0.5 text-primary" />
            <div className="space-y-1">
              <h2 className="font-serif text-[28px] leading-9 text-on-surface">{t('auth.resetSuccessTitle')}</h2>
              <p className="text-[14px] leading-6 text-on-surface-variant">{t('auth.resetSuccessBody')}</p>
            </div>
          </header>
          <Link to="/login" className={primaryLinkCls}>
            {t('auth.backToSignIn')} <Icon name="arrow_forward" size="sm" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (view === 'invalid') {
    return (
      <AuthLayout>
        <div className="space-y-6">
          <header className="flex items-start gap-3">
            <Icon name="error" className="mt-0.5 text-error" />
            <div className="space-y-1">
              <h2 className="font-serif text-[28px] leading-9 text-on-surface">{t('auth.resetInvalidTitle')}</h2>
              <p className="text-[14px] leading-6 text-on-surface-variant">{t('auth.resetInvalidBody')}</p>
            </div>
          </header>
          <div className="flex flex-col gap-3">
            <Link to="/forgot-password" className={primaryLinkCls}>
              {t('auth.forgotCta')} <Icon name="arrow_forward" size="sm" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-primary hover:underline underline-offset-4">
              <Icon name="arrow_back" size="sm" /> {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className="space-y-1">
        <h2 className="font-serif text-[32px] leading-10 text-on-surface">{t('auth.resetTitle')}</h2>
        <p className="text-[14px] text-on-surface-variant">{t('auth.resetSubtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-lg">
        <AuthField
          id="new-password" label={t('auth.newPassword')} type={show ? 'text' : 'password'} autoComplete="new-password" required
          minLength={MIN_LEN} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
          rightSlot={
            <button type="button" onClick={() => setShow(s => !s)}
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
              aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}>
              <Icon name={show ? 'visibility_off' : 'visibility'} size="sm" />
            </button>
          }
        />
        <AuthField
          id="confirm-password" label={t('auth.confirmPassword')} type={show ? 'text' : 'password'} autoComplete="new-password" required
          minLength={MIN_LEN} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
        />
        <p className="text-[12px] text-on-surface-variant">{t('auth.passwordMin')}</p>
        {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
        <Button type="submit" fullWidth loading={busy} className="rounded-lg py-3">
          {t('auth.resetCta')} <Icon name="arrow_forward" size="sm" />
        </Button>
      </form>

      <p className="text-[14px] text-on-surface-variant">
        <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline underline-offset-4">
          <Icon name="arrow_back" size="sm" /> {t('auth.backToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
