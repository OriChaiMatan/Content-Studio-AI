import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../../components/layout/TopBar';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Input } from '../../../components/ui/Input';
import { useContentCasesStore } from '../../../stores/contentCasesStore';
import type { WizardFormData, ContentGoal, ContentStyle, ContentTarget, Language } from '../../../types';

// ── Option definitions ────────────────────────────────────

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
  { value: 'instagram',   label: 'Instagram',   icon: 'photo_camera' },
  { value: 'newsletter',  label: 'Newsletter',  icon: 'email' },
  { value: 'podcast',     label: 'Podcast',     icon: 'mic' },
  { value: 'images',      label: 'Images',      icon: 'image' },
];

const STEPS = ['Goal', 'Style & Language', 'Content Targets'];

const emptyForm: WizardFormData = {
  title:          '',
  contentGoal:    'build_authority',
  goalCustom:     '',
  contentStyle:   'professional',
  styleCustom:    '',
  language:       'en',
  contentTargets: [],
};

// ── Step components ───────────────────────────────────────

function Step1Goal({
  form, update,
}: {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(k: K, v: WizardFormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <Input
        label="Case Name *"
        type="text"
        value={form.title}
        onChange={e => update('title', e.target.value)}
        placeholder="e.g. Quantum Computing 2024"
        autoFocus
      />

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

function Step2StyleLanguage({
  form, update,
}: {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(k: K, v: WizardFormData[K]) => void;
}) {
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
        <label className="text-[14px] font-medium text-on-surface-variant">Language *</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'en', label: 'English', sub: 'Left-to-right' },
            { value: 'he', label: 'Hebrew (עברית)', sub: 'Right-to-left' },
          ] as { value: Language; label: string; sub: string }[]).map(lang => (
            <button
              key={lang.value}
              type="button"
              onClick={() => update('language', lang.value)}
              className={[
                'flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all',
                form.language === lang.value
                  ? 'border-primary bg-secondary-container/40'
                  : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <span className={`text-[14px] font-bold ${form.language === lang.value ? 'text-primary' : 'text-on-surface'}`}>
                {lang.label}
              </span>
              <span className="text-[11px] text-on-surface-variant">{lang.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3Targets({
  form, update,
}: {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(k: K, v: WizardFormData[K]) => void;
}) {
  function toggleTarget(t: ContentTarget) {
    const next = form.contentTargets.includes(t)
      ? form.contentTargets.filter(x => x !== t)
      : [...form.contentTargets, t];
    update('contentTargets', next);
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-on-surface-variant">
        Select the platforms you want content generated for. At least one required.
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
                'flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all',
                selected
                  ? 'border-primary bg-secondary-container/40 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <Icon name={opt.icon} size="sm" className={selected ? 'text-primary' : 'text-outline'} />
              <span className="text-[14px] font-medium">{opt.label}</span>
              {selected && (
                <Icon name="check_circle" size="sm" className="text-primary ml-auto" filled />
              )}
            </button>
          );
        })}
      </div>
      {form.contentTargets.length === 0 && (
        <p className="text-[12px] text-error">Please select at least one target.</p>
      )}
    </div>
  );
}

// ── Wizard page ───────────────────────────────────────────

export function CreateCaseWizard() {
  const navigate = useNavigate();
  const createCase = useContentCasesStore(s => s.createCase);
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState<WizardFormData>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function update<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setCreateError(null);
  }

  const canNext = step === 0
    ? form.title.trim().length > 0
    : step === 1
    ? true // style + language always have defaults
    : form.contentTargets.length > 0; // step 3: must have at least one target

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

      <main className="flex-1 overflow-y-auto p-8">
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
                  <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-outline'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 rounded-full mb-4 ${i < step ? 'bg-green-400' : 'bg-outline-variant'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-8 min-h-[380px]">
            {step === 0 && <Step1Goal form={form} update={update} />}
            {step === 1 && <Step2StyleLanguage form={form} update={update} />}
            {step === 2 && <Step3Targets form={form} update={update} />}
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
              <Button
                onClick={handleCreate}
                disabled={!canNext || creating}
                loading={creating}
              >
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
