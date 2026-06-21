import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { SectionCard } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { api, ApiError } from '../../lib/api';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import type { Language } from '../../types';

// ── Language segmented control (instant-save) ─────────────────────────────────
// Used for BOTH App language and Content output language — they are independent
// persistent settings, so each instance carries its own value + onChange.
const LANG_OPTIONS: { value: Language; label: string; sub: string }[] = [
  { value: 'en', label: 'English', sub: 'English (US)' },
  { value: 'he', label: 'Hebrew', sub: 'עברית' },
];

function LanguageSegmented({
  value, onChange, ariaLabel,
}: { value: Language; onChange: (v: Language) => void; ariaLabel: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant/30"
    >
      {LANG_OPTIONS.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors',
              active
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {active && <Icon name="check" size="sm" />}
            <span>{opt.label}</span>
            <span className="text-[12px] text-on-surface-variant/70">{opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── WhatsApp — premium connected-channel card (read-only status) ──────────────
function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
        connected ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-outline'}`} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`font-medium ${accent ? 'text-green-700' : 'text-on-surface'}`}>{value}</span>
    </div>
  );
}

function WhatsAppCard() {
  const authUser = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const wa = authUser?.whatsapp;
  const verified = !!wa?.verified;
  const linked = !!wa?.linked;
  const notificationsOn = !!wa && !wa.optOut && !!authUser?.notifications.generationComplete;

  return (
    <div className="rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm">
      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-green-50 to-surface-container-lowest">
        {/* Channel mark */}
        <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center shrink-0 shadow-sm">
          <Icon name="chat" className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[16px] font-semibold text-on-surface">WhatsApp</h4>
            <StatusPill connected={verified} />
          </div>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-md">
            Send articles and sources directly to your AI workspace.
          </p>

          {verified ? (
            <div className="mt-4 space-y-2 rounded-xl bg-surface-container-lowest/70 border border-outline-variant/30 p-4">
              <DetailRow label="Phone" value={wa?.phoneE164 ?? '—'} />
              <DetailRow label="Verification" value="Verified" accent />
              <DetailRow label="Notifications" value={notificationsOn ? 'On' : 'Off'} />
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-surface-container-lowest/70 border border-outline-variant/30 p-4">
              <p className="text-[13px] text-on-surface-variant mb-3">
                {linked ? (
                  <>Your number{wa?.phoneE164 ? <> <span className="font-medium text-on-surface">{wa.phoneE164}</span></> : ''} is added but not verified yet. Verify it to enable WhatsApp.</>
                ) : (
                  'Connect WhatsApp to forward articles and notes to your workspace from your phone.'
                )}
              </p>
              <Button size="sm" onClick={() => navigate('/verify-whatsapp')}>
                <Icon name="link" size="sm" />
                Connect WhatsApp
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Telegram — interactive connect-via-deep-link card ─────────────────────────
function TelegramCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [username,  setUsername]  = useState<string | null>(null);
  const [link,      setLink]      = useState<string | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<{ connected: boolean; username: string | null }>('/integrations/telegram/status')
      .then(s => { if (alive) { setConnected(s.connected); setUsername(s.username); } })
      .catch(() => { if (alive) setConnected(false); });
    return () => { alive = false; };
  }, []);

  async function connect() {
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ linkUrl: string; expiresAt: string }>('/integrations/telegram/link-token', {});
      setLink(r.linkUrl);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { setConnected(true); }
      else if (e instanceof ApiError && e.status === 503) { setError('Telegram isn’t configured on the server yet.'); }
      else { setError('Could not start Telegram connection. Please try again.'); }
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm">
      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-sky-50 to-surface-container-lowest">
        <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shrink-0 shadow-sm">
          <Icon name="send" className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[16px] font-semibold text-on-surface">Telegram</h4>
            <StatusPill connected={connected === true} />
          </div>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-md">
            Forward links and notes to your AI workspace from Telegram.
          </p>

          {connected ? (
            <div className="mt-4 space-y-2 rounded-xl bg-surface-container-lowest/70 border border-outline-variant/30 p-4">
              <DetailRow label="Account" value={username ? `@${username}` : 'Linked'} />
              <DetailRow label="Status" value="Verified" accent />
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-surface-container-lowest/70 border border-outline-variant/30 p-4">
              {!link ? (
                <>
                  <p className="text-[13px] text-on-surface-variant mb-3">
                    Connect your Telegram account, then send articles and notes to the bot to add them as sources.
                  </p>
                  <Button size="sm" onClick={connect} loading={busy} disabled={busy}>
                    <Icon name="link" size="sm" />
                    Connect Telegram
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <ol className="text-[13px] text-on-surface-variant list-decimal ms-5 space-y-1">
                    <li>Open the link below and tap <span className="font-medium text-on-surface">Start</span> in Telegram.</li>
                    <li>You’ll get a confirmation message from the bot.</li>
                    <li>Come back here — the status updates on your next visit.</li>
                  </ol>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white text-[13px] font-semibold hover:bg-sky-600 transition-colors"
                  >
                    <Icon name="open_in_new" size="sm" />
                    Open in Telegram
                  </a>
                  <p className="text-[11px] text-outline break-all">{link}</p>
                  <p className="text-[11px] text-amber-700">This link expires in 10 minutes and can be used once.</p>
                </div>
              )}
              {error && <p className="text-[12px] text-error mt-2">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user, updateUser, updateNotification } = useSettingsStore();
  const outputLanguage = user.defaultOutputLanguage ?? 'he';

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <TopBar title="Settings" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto w-full">

          {/* Header */}
          <div className="mb-6">
            <p className="text-[15px] text-on-surface-variant">
              Manage your account, preferences, and integrations
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-on-surface-variant">
              <Icon name="cloud_done" size="sm" className="text-green-600" />
              Changes are saved automatically
            </p>
          </div>

          <div className="space-y-6">

            {/* ── 1. Profile ──────────────────────────────────── */}
            <SectionCard title="Profile" icon="account_circle">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-on-primary text-2xl font-bold shadow-sm overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    Update photo
                  </button>
                </div>

                {/* Identity fields */}
                <div className="flex-1 min-w-0 w-full space-y-5">
                  <Input
                    label="Full name"
                    type="text"
                    value={user.name}
                    onChange={e => updateUser({ name: e.target.value })}
                  />
                  <Input
                    label="Email address"
                    type="email"
                    value={user.email}
                    onChange={e => updateUser({ email: e.target.value })}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-on-surface-variant mb-1.5">Role</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[13px] font-medium">
                      <Icon name="workspace_premium" size="sm" />
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── 2. Integrations (WhatsApp prominent) ─────────── */}
            <SectionCard title="Integrations" icon="hub">
              <WhatsAppCard />
              <TelegramCard />

              {/* Future channels — signals extensibility */}
              <div className="mt-5 pt-5 border-t border-outline-variant/30">
                <p className="text-[12px] font-medium text-on-surface-variant mb-3">More integrations</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Notion', icon: 'description' },
                    { name: 'Google Drive', icon: 'cloud' },
                    { name: 'RSS', icon: 'rss_feed' },
                    { name: 'Slack', icon: 'forum' },
                  ].map(ch => (
                    <span
                      key={ch.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-[12px] text-on-surface-variant/80"
                    >
                      <Icon name={ch.icon} size="sm" />
                      {ch.name}
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-outline">Soon</span>
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* ── 3. Preferences ──────────────────────────────── */}
            <SectionCard title="Preferences" icon="tune">
              <div className="space-y-7">
                {/* App language */}
                <div>
                  <p className="text-[15px] font-medium text-on-surface">App language</p>
                  <p className="text-[13px] text-on-surface-variant mb-3">
                    Language for the interface, menus, and navigation.
                  </p>
                  <LanguageSegmented
                    ariaLabel="App language"
                    value={user.language}
                    onChange={v => updateUser({ language: v })}
                  />
                </div>

                {/* Content output language — separate persistent setting */}
                <div>
                  <p className="text-[15px] font-medium text-on-surface">Content output language</p>
                  <p className="text-[13px] text-on-surface-variant mb-3">
                    Default language for new content cases. You can still change it per case.
                  </p>
                  <LanguageSegmented
                    ariaLabel="Content output language"
                    value={outputLanguage}
                    onChange={v => updateUser({ defaultOutputLanguage: v })}
                  />
                </div>

                {/* Timezone — placeholder for future scheduling control */}
                <div>
                  <p className="text-[15px] font-medium text-on-surface">Timezone</p>
                  <p className="text-[13px] text-on-surface-variant mb-3">
                    Used for scheduled generation. Coming soon.
                  </p>
                  <select
                    disabled
                    className="bg-surface-container-low border border-outline-variant/40 rounded-lg text-[14px] text-on-surface-variant px-3 py-2 cursor-not-allowed opacity-70"
                  >
                    <option>Asia/Jerusalem (UTC+3)</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            {/* ── 4. Notifications ────────────────────────────── */}
            <SectionCard title="Notifications" icon="notifications_active">
              <div className="space-y-4">
                <Toggle
                  id="notif-generation"
                  label="Generation Complete"
                  description="Notify when an AI content draft is ready"
                  checked={user.notifications.generationComplete}
                  onChange={v => updateNotification('generationComplete', v)}
                />
                <Toggle
                  id="notif-draft"
                  label="Draft Ready for Review"
                  description="Daily summary of items pending editorial approval"
                  checked={user.notifications.draftReady}
                  onChange={v => updateNotification('draftReady', v)}
                />
                <Toggle
                  id="notif-factcheck"
                  label="Fact Check Conflict"
                  description="Alert if automated cross-reference finds discrepancies"
                  checked={user.notifications.factCheckConflict}
                  onChange={v => updateNotification('factCheckConflict', v)}
                />
              </div>
            </SectionCard>

          </div>
        </div>
      </main>
    </>
  );
}
