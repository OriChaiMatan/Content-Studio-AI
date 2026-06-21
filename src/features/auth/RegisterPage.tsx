import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useAuthStore } from '../../stores/authStore';
import { AuthLayout, AuthField } from './AuthLayout';

// Strict E.164 mirror of the server validator (backend authSchemas) for instant feedback.
const E164_RE = /^\+[1-9]\d{7,14}$/;

// Phase 12 · Part 2 — editorial registration. Phase 13B adds the WhatsApp number and
// redirects to /verify-whatsapp on success so verification is the next step.
export function RegisterPage() {
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!E164_RE.test(whatsappPhone.trim())) {
      setError('Enter a valid WhatsApp number in international format, e.g. +972501234567');
      return;
    }
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password, whatsappPhone.trim());
      // Authenticated now; enter the app. WhatsApp verification is opt-in from
      // Settings ("Connect WhatsApp") — no forced verification step.
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <header className="space-y-1">
        <h2 className="font-serif text-[32px] leading-10 text-on-surface">Create your account</h2>
        <p className="text-[14px] text-on-surface-variant">Begin your editorial workspace.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-lg">
        <AuthField
          id="name" label="Full name" type="text" autoComplete="name" required
          value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Julian Vance"
        />
        <AuthField
          id="email" label="Email address" type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} placeholder="name@organization.com"
        />
        <AuthField
          id="whatsappPhone" label="WhatsApp number" type="tel" autoComplete="tel" inputMode="tel" required
          value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)} placeholder="+972501234567"
        />
        <AuthField
          id="password" label="Password" type={show ? 'text' : 'password'} autoComplete="new-password" required
          value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
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
          Create account <Icon name="arrow_forward" size="sm" />
        </Button>
      </form>

      <p className="text-[14px] text-on-surface-variant">
        Already a member?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline underline-offset-4">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
