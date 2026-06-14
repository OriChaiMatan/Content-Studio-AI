import { useState } from 'react';
import { TopBar } from '../../components/layout/TopBar';
import { SectionCard } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Button } from '../../components/ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';

// Read-only status row for the WhatsApp section (Phase 13G).
function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-medium text-on-surface">{value}</span>
    </div>
  );
}

export function SettingsPage() {
  const { user, updateUser, updateNotification } = useSettingsStore();
  // Phase 13G — real authenticated user (carries WhatsApp status); read-only here.
  const authUser = useAuthStore(s => s.user);
  const wa = authUser?.whatsapp;
  const waNotificationsOn = !!wa && !wa.optOut && !!authUser?.notifications.generationComplete;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  function handleSave() {
    setSaveState('saving');
    setTimeout(() => {
      updateUser({ name, email });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }, 900);
  }

  function handleDiscard() {
    setName(user.name);
    setEmail(user.email);
    setSaveState('idle');
  }

  return (
    <>
      <TopBar title="Settings" searchPlaceholder="Search settings..." />

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Left column */}
          <div className="md:col-span-8 space-y-6">

            {/* Account */}
            <SectionCard title="Account" icon="person">
              <div className="grid grid-cols-1 gap-6">
                <Input
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </SectionCard>

            {/* Notifications */}
            <SectionCard title="Notifications" icon="notifications_active">
              <div className="space-y-4">
                <Toggle
                  id="notif-generation"
                  label="Generation Complete"
                  description="Notify when AI content draft is ready"
                  checked={user.notifications.generationComplete}
                  onChange={v => updateNotification('generationComplete', v)}
                />
                <Toggle
                  id="notif-factcheck"
                  label="Fact Check Conflict"
                  description="Alert if automated cross-reference finds discrepancies"
                  checked={user.notifications.factCheckConflict}
                  onChange={v => updateNotification('factCheckConflict', v)}
                />
                <Toggle
                  id="notif-draft"
                  label="Draft Ready For Review"
                  description="Daily summary of items pending editorial approval"
                  checked={user.notifications.draftReady}
                  onChange={v => updateNotification('draftReady', v)}
                />
              </div>
            </SectionCard>

            {/* WhatsApp (read-only status — Phase 13G) */}
            <SectionCard title="WhatsApp" icon="chat">
              {wa?.linked ? (
                <div className="space-y-3 text-[14px]">
                  <StatusRow label="Connected" value="Yes" />
                  <StatusRow label="Phone" value={wa.phoneE164 ?? '—'} />
                  <StatusRow label="Verified" value={wa.verified ? 'Yes' : 'No'} />
                  <StatusRow label="Notifications" value={waNotificationsOn ? 'On' : 'Off'} />
                </div>
              ) : (
                <p className="text-[14px] text-on-surface-variant">Not connected</p>
              )}
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="md:col-span-4 space-y-6">

            {/* Language */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/30">
              <h3 className="text-[22px] font-serif font-medium text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">translate</span>
                Language
              </h3>
              <div className="space-y-2">
                {[
                  { value: 'en', label: 'English (US)' },
                  { value: 'he', label: 'Hebrew (עברית)' },
                ].map(lang => {
                  const isActive = user.language === lang.value;
                  return (
                    <label
                      key={lang.value}
                      className={[
                        'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container border-primary/20'
                          : 'bg-surface-container-low hover:bg-surface-container border-transparent',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="lang"
                        value={lang.value}
                        checked={isActive}
                        onChange={() => updateUser({ language: lang.value as 'en' | 'he' })}
                        className="w-5 h-5 text-primary border-outline-variant"
                      />
                      <span className="text-[14px] font-medium flex-1">{lang.label}</span>
                      {isActive && <span className="material-symbols-outlined text-primary">check_circle</span>}
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] text-on-surface-variant">
                Interface mirroring and typography will adjust automatically based on your selection.
              </p>
            </div>

            {/* Profile visual */}
            <div className="bg-primary-container p-8 rounded-xl text-on-primary-container flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-on-primary text-2xl font-bold shadow-lg border-4 border-surface">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div>
                <h4 className="text-[22px] font-serif font-medium">{user.name}</h4>
                <p className="text-[14px] text-on-primary-container/80">{user.role}</p>
              </div>
              <button className="bg-surface text-primary font-bold px-6 py-2 rounded-full text-[14px] hover:bg-surface-bright transition-colors active:scale-95">
                Update Photo
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 pt-6 border-t border-outline-variant flex justify-end items-center gap-6">
          <Button variant="ghost" onClick={handleDiscard}>
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saveState === 'saving'}
            className={saveState === 'saved' ? '!bg-green-600' : ''}
          >
            {saveState === 'saved' ? (
              <><span className="material-symbols-outlined text-base">check</span> Changes Saved</>
            ) : (
              <><span className="material-symbols-outlined text-base">save</span> Save Changes</>
            )}
          </Button>
        </div>
      </main>
    </>
  );
}
