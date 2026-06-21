import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../../components/layout/TopBar';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Input } from '../../../components/ui/Input';
import { useContentCasesStore } from '../../../stores/contentCasesStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { WizardFormData, Language, ContentGoal, ContentStyle, ContentTarget, ScheduleFrequency } from '../../../types';

// ── Option definitions ────────────────────────────────────

// Output language for the case (Hebrew-first MVP — defaults to 'he').
const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'he', label: 'Hebrew (עברית)' },
  { value: 'en', label: 'English' },
];
const languageLabel = (l: Language) => LANGUAGE_OPTIONS.find(o => o.value === l)?.label ?? l;

const GOAL_OPTIONS: { value: ContentGoal; label: string; icon: string }[] = [
  { value: 'build_authority',   label: 'Build Authority',    icon: 'star' },
  { value: 'generate_leads',    label: 'Generate Leads',     icon: 'person_add' },
  { value: 'increase_sales',    label: 'Increase Sales',     icon: 'trending_up' },
  { value: 'educate_audience',  label: 'Educate Audience',   icon: 'school' },
  { value: 'grow_community',    label: 'Grow Community',     icon: 'groups' },
  { value: 'personal_branding', label: 'Personal Branding',  icon: 'badge' },
  { value: 'other',             label: 'Other',              icon: 'more_horiz' },
];

const STYLE_OPTIONS: { value: ContentStyle; label: string }[] = [
  { value: 'professional',  label: 'Professional' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'friendly',      label: 'Friendly' },
  { value: 'personal',      label: 'Personal' },
  { value: 'journalistic',  label: 'Journalistic' },
  { value: 'provocative',   label: 'Provocative' },
  { value: 'humorous',      label: 'Humorous' },
  { value: 'other',         label: 'Other' },
];

const TARGET_OPTIONS: { value: ContentTarget; label: string; icon: string }[] = [
  { value: 'linkedin',    label: 'LinkedIn',    icon: 'work' },
  { value: 'facebook',    label: 'Facebook',    icon: 'groups' },
  { value: 'newsletter',  label: 'Newsletter',  icon: 'email' },
];

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string; sub: string; icon: string }[] = [
  { value: 'manual',  label: 'Manual only', sub: 'Generate on demand',     icon: 'touch_app' },
  { value: 'daily',   label: 'Daily',       sub: 'Every day at a set time', icon: 'today' },
  { value: 'weekly',  label: 'Weekly',      sub: 'A chosen day each week',  icon: 'date_range' },
  { value: 'monthly', label: 'Monthly',     sub: 'A chosen day each month', icon: 'calendar_month' },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const STEPS = ['Goal', 'Style & Targets', 'Schedule'];

const emptyForm: WizardFormData = {
  title:          '',
  language:       'he',
  contentGoal:    'build_authority',
  goalCustom:     '',
  contentStyle:   'professional',
  styleCustom:    '',
  contentTargets: [],
  scheduleFrequency:  'manual',
  scheduleTime:       '09:00',
  scheduleDayOfWeek:  1,
  scheduleDayOfMonth: 1,
};

type UpdateFn = <K extends keyof WizardFormData>(k: K, v: WizardFormData[K]) => void;

// ── Step 1 — Case Name + Goal ─────────────────────────────

function Step1Goal({ form, update }: { form: WizardFormData; update: UpdateFn }) {
  return (
    <div className="space-y-6">
      <Input
        label="What are you creating content about? *"
        type="text"
        value={form.title}
        onChange={e => update('title', e.target.value)}
        placeholder="e.g. Quantum Computing 2024"
        autoFocus
      />

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Output Language *</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          The language all generated content for this case will be written in.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('language', opt.value)}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-[13px] font-medium text-left transition-all',
                form.language === opt.value
                  ? 'border-primary bg-secondary-container/40 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <Icon name="translate" size="sm" className={form.language === opt.value ? 'text-primary' : 'text-outline'} />
              {opt.label}
              {form.language === opt.value && <Icon name="check_circle" size="sm" className="text-primary ml-auto" filled />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Goal *</label>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('contentGoal', opt.value)}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-[13px] font-medium text-left transition-all',
                form.contentGoal === opt.value
                  ? 'border-primary bg-secondary-container/40 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <Icon name={opt.icon} size="sm" className={form.contentGoal === opt.value ? 'text-primary' : 'text-outline'} />
              {opt.label}
            </button>
          ))}
        </div>
        {form.contentGoal === 'other' && (
          <Input
            type="text"
            value={form.goalCustom}
            onChange={e => update('goalCustom', e.target.value)}
            placeholder="Describe your goal (optional)"
            className="mt-1"
          />
        )}
      </div>
    </div>
  );
}

// ── Step 2 — Content Style + Content Targets ──────────────

function Step2StyleTargets({ form, update }: { form: WizardFormData; update: UpdateFn }) {
  function toggleTarget(t: ContentTarget) {
    const next = form.contentTargets.includes(t)
      ? form.contentTargets.filter(x => x !== t)
      : [...form.contentTargets, t];
    update('contentTargets', next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Content Style *</label>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('contentStyle', opt.value)}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-[13px] font-medium text-left transition-all',
                form.contentStyle === opt.value
                  ? 'border-primary bg-secondary-container/40 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {form.contentStyle === 'other' && (
          <Input
            type="text"
            value={form.styleCustom}
            onChange={e => update('styleCustom', e.target.value)}
            placeholder="Describe your content style (optional)"
            className="mt-1"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Where should we publish? *</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          Select the platforms to generate content for. At least one required.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {TARGET_OPTIONS.map(opt => {
            const selected = form.contentTargets.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTarget(opt.value)}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all',
                  selected
                    ? 'border-primary bg-secondary-container/40 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
                ].join(' ')}
              >
                <Icon name={opt.icon} size="sm" className={selected ? 'text-primary' : 'text-outline'} />
                <span className="text-[14px] font-medium">{opt.label}</span>
                {selected && <Icon name="check_circle" size="sm" className="text-primary ml-auto" filled />}
              </button>
            );
          })}
        </div>
        {form.contentTargets.length === 0 && (
          <p className="text-[12px] text-error">Please select at least one target.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 3 — Generate Schedule ────────────────────────────

function Step3Schedule({ form, update }: { form: WizardFormData; update: UpdateFn }) {
  const freq = form.scheduleFrequency;
  return (
    <div className="space-y-6">
      {/* Compact pre-creation summary of the chosen output language (no dedicated Review step). */}
      <div className="flex items-center gap-2 text-[13px] bg-surface-container rounded-lg px-3 py-2.5">
        <Icon name="translate" size="sm" className="text-primary" />
        <span className="text-on-surface-variant">Output language:</span>
        <span className="font-bold text-on-surface">{languageLabel(form.language)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">When should content be generated?</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          When should this case generate new content? You can always use <strong>Generate Now</strong> regardless of this setting.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FREQUENCY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('scheduleFrequency', opt.value)}
              className={[
                'flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all',
                freq === opt.value
                  ? 'border-primary bg-secondary-container/40'
                  : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <Icon name={opt.icon} size="sm" className={freq === opt.value ? 'text-primary' : 'text-outline'} />
                <span className={`text-[14px] font-bold ${freq === opt.value ? 'text-primary' : 'text-on-surface'}`}>{opt.label}</span>
              </span>
              <span className="text-[11px] text-on-surface-variant">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditional fields */}
      {freq !== 'manual' && (
        <div className="grid grid-cols-2 gap-4">
          {freq === 'weekly' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-on-surface-variant">Day of week</label>
              <select
                value={form.scheduleDayOfWeek}
                onChange={e => update('scheduleDayOfWeek', Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface"
              >
                {DAY_OF_WEEK_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}
          {freq === 'monthly' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-on-surface-variant">Day of month</label>
              <select
                value={form.scheduleDayOfMonth}
                onChange={e => update('scheduleDayOfMonth', Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-on-surface-variant">Time</label>
            <Input
              type="time"
              value={form.scheduleTime}
              onChange={e => update('scheduleTime', e.target.value)}
            />
          </div>
        </div>
      )}

      {freq === 'manual' && (
        <div className="flex items-center gap-2 text-[13px] text-on-surface-variant bg-surface-container rounded-lg px-3 py-2.5">
          <Icon name="info" size="sm" className="text-outline" />
          Content will only be generated when you click Generate Now.
        </div>
      )}
    </div>
  );
}

// ── Wizard page ───────────────────────────────────────────

export function CreateCaseWizard() {
  const navigate = useNavigate();
  const createCase = useContentCasesStore(s => s.createCase);
  // Seed the output language from the user's default-output-language setting
  // (overridable per case below). Falls back to the Hebrew-first MVP default.
  const defaultOutputLanguage = useSettingsStore(s => s.user.defaultOutputLanguage);
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState<WizardFormData>(() => ({
    ...emptyForm,
    language: defaultOutputLanguage ?? emptyForm.language,
  }));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function update<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setCreateError(null);
  }

  const canNext = step === 0
    ? form.title.trim().length > 0
    : step === 1
    ? form.contentTargets.length > 0   // style has a default; targets required
    : true;                            // step 3 (schedule) always valid

  async function handleCreate() {
    if (creating || form.contentTargets.length === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const newCase = await createCase(form);
      navigate(`/cases/${newCase.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create case. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <TopBar
        title="New Content Case"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/cases')}>
            <Icon name="close" size="sm" />
            Cancel
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all',
                    i === step   ? 'bg-primary text-on-primary scale-110 shadow-md' :
                    i < step     ? 'bg-green-500 text-white' :
                    'bg-surface-container text-outline',
                  ].join(' ')}>
                    {i < step ? <Icon name="check" size="sm" /> : i + 1}
                  </div>
                  <span className={`hidden sm:block text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-outline'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-16 h-0.5 rounded-full sm:mb-4 ${i < step ? 'bg-green-400' : 'bg-outline-variant'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-5 md:p-8 min-h-[380px]">
            {step === 0 && <Step1Goal form={form} update={update} />}
            {step === 1 && <Step2StyleTargets form={form} update={update} />}
            {step === 2 && <Step3Schedule form={form} update={update} />}
          </div>

          {/* Error banner */}
          {createError && (
            <div className="mt-4 flex items-start gap-3 bg-error-container/60 border border-error/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-error text-base shrink-0 mt-0.5">error</span>
              <p className="text-[13px] text-on-error-container">{createError}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
              <Icon name="arrow_back" size="sm" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                Next
                <Icon name="arrow_forward" size="sm" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!canNext || creating} loading={creating}>
                <Icon name="rocket_launch" size="sm" />
                {creating ? 'Creating…' : 'Create Content Case'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
