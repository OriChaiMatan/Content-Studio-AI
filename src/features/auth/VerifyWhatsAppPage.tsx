import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useAuthStore } from '../../stores/authStore';

// Strict E.164 mirror of the server validator (used by change-number).
const E164_RE = /^\+[1-9]\d{7,14}$/;

// Phase 13B — user-initiated WhatsApp verification. The user sends the displayed
// code from their WhatsApp to the business number; the inbound webhook flips the
// identity to verified. This page polls /auth/me to detect that and offers resend /
// change-number / skip. Verification is NOT a hard gate — "skip" enters the app.
export function VerifyWhatsAppPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const verification = useAuthStore(s => s.whatsappVerification);
  const loadMe = useAuthStore(s => s.loadMe);
  const resend = useAuthStore(s => s.resendWhatsappCode);
  const changeNumber = useAuthStore(s => s.changeWhatsappNumber);

  const verified = user?.whatsapp.verified ?? false;
  const [busy, setBusy] = useState<null | 'check' | 'resend'>(null);
  const [error, setError] = useState<string | null>(null);

  // Change-number inline form.
  const [editing, setEditing] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [changing, setChanging] = useState(false);

  // Auto-poll /auth/me every 5s while unverified so the screen flips on its own once
  // the user sends the code. Stops once verified.
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (verified) return;
    pollRef.current = window.setInterval(() => { void loadMe(); }, 5000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [verified, loadMe]);

  async function handleCheck() {
    setError(null); setBusy('check');
    try { await loadMe(); } finally { setBusy(null); }
  }

  async function handleResend() {
    setError(null); setBusy('resend');
    try { await resend(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to resend code'); }
    finally { setBusy(null); }
  }

  async function handleChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!E164_RE.test(newPhone.trim())) {
      setError('Enter a valid WhatsApp number in international format, e.g. +972501234567');
      return;
    }
    setChanging(true);
    try {
      await changeNumber(newPhone.trim());
      setEditing(false); setNewPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change number');
    } finally {
      setChanging(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────────
  if (verified) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <Icon name="verified" size="xl" className="text-primary" filled />
          <h2 className="font-serif text-[28px] text-on-surface">WhatsApp verified</h2>
          <p className="text-[14px] text-on-surface-variant max-w-sm">
            Your WhatsApp number is connected. WhatsApp features are now enabled for your account.
          </p>
          <Button onClick={() => navigate('/', { replace: true })} className="mt-2">
            Continue to app <Icon name="arrow_forward" size="sm" />
          </Button>
        </div>
      </Shell>
    );
  }

  // The number to display: prefer the full number from the verification payload;
  // fall back to the masked number from /me after a reload.
  const shownNumber = verification?.phoneE164 ?? user?.whatsapp.phoneE164 ?? '';
  const businessNumber = verification?.businessNumber ?? null;
  const code = verification?.code ?? null;

  return (
    <Shell>
      <header className="space-y-1">
        <h2 className="font-serif text-[28px] text-on-surface">Verify your WhatsApp</h2>
        <p className="text-[14px] text-on-surface-variant">
          A quick one-time step so we can send and receive content on WhatsApp.
        </p>
      </header>

      {code ? (
        <ol className="space-y-4 text-[14px] text-on-surface">
          <li className="flex gap-3">
            <StepDot n={1} />
            <span>Open WhatsApp on the phone for <strong>{shownNumber}</strong>.</span>
          </li>
          <li className="flex gap-3">
            <StepDot n={2} />
            <div className="space-y-2">
              <span>Send this exact code to our WhatsApp number:</span>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-surface-container px-4 py-2 font-mono text-[20px] tracking-[0.3em] text-on-surface">{code}</code>
                {businessNumber && (
                  <span className="text-[13px] text-on-surface-variant">
                    to <strong className="text-on-surface">{businessNumber}</strong>
                  </span>
                )}
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <StepDot n={3} />
            <span>This page updates automatically once we receive it.</span>
          </li>
        </ol>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-[14px] text-on-surface-variant">
          Your code isn’t shown here anymore (page was reloaded). Tap <strong>Resend code</strong> to get a fresh one.
        </div>
      )}

      {error && <p className="text-[13px] text-error" role="alert">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCheck} loading={busy === 'check'} variant="primary">
          <Icon name="refresh" size="sm" /> Check status
        </Button>
        <Button onClick={handleResend} loading={busy === 'resend'} variant="outline">
          Resend code
        </Button>
        <Button onClick={() => setEditing(v => !v)} variant="ghost">
          Change number
        </Button>
      </div>

      {editing && (
        <form onSubmit={handleChange} className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <label className="flex flex-col gap-1 text-[12px] text-on-surface-variant">
            New WhatsApp number
            <input
              value={newPhone} onChange={e => setNewPhone(e.target.value)}
              placeholder="+972501234567" inputMode="tel"
              className="min-w-[16rem] rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-[14px] text-on-surface outline-none focus:border-primary"
            />
          </label>
          <Button type="submit" loading={changing} size="sm">Update &amp; resend</Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="self-start text-[13px] text-on-surface-variant underline-offset-4 hover:text-primary hover:underline"
      >
        Skip for now — I’ll verify later
      </button>
    </Shell>
  );
}

// Centered editorial shell consistent with the in-app surface.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-[34rem] space-y-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
      {n}
    </span>
  );
}
