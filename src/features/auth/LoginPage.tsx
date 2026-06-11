import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useAuthStore } from '../../stores/authStore';
import { AuthLayout, AuthField } from './AuthLayout';

// Phase 12 · Part 2 — editorial login. Wired to authStore.login; route guard
// redirects to "/" once status flips to authenticated.
export function LoginPage() {
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <header className="space-y-1">
        <h2 className="font-serif text-[32px] leading-10 text-on-surface">Sign in</h2>
        <p className="text-[14px] text-on-surface-variant">Access your editorial suite.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-lg">
        <AuthField
          id="email" label="Email address" type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} placeholder="name@organization.com"
        />
        <AuthField
          id="password" label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required
          value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
          rightSlot={
            <button type="button" onClick={() => setShow(s => !s)}
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
              aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'visibility_off' : 'visibility'} size="sm" />
            </button>
          }
        />
        {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
        <Button type="submit" fullWidth loading={busy} className="rounded-lg py-3">
          Sign in <Icon name="arrow_forward" size="sm" />
        </Button>
      </form>

      <p className="text-[14px] text-on-surface-variant">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-primary hover:underline underline-offset-4">Create one</Link>
      </p>
    </AuthLayout>
  );
}
