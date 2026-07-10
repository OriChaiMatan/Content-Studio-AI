import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../../components/layout/TopBar';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Input } from '../../../components/ui/Input';
import { useContentCasesStore } from '../../../stores/contentCasesStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCaseLimitContent, useActiveCaseLimitContent, useSchedulingAllowed } from '../../../hooks/useQuotaGate';
import { useQuotaModalStore } from '../../../stores/quotaModalStore';
import { useActiveCaseLimitModalStore } from '../../../stores/activeCaseLimitModalStore';
import { isQuotaApiError } from '../../../lib/api';
import { useT } from '../../../i18n/useT';
import type { StringKey } from '../../../i18n/strings';
import type { WizardFormData, Language, ContentGoal, ContentStyle, ContentTarget, ScheduleFrequency } from '../../../types';

// ── Option definitions (labels via i18n keys; platform brand names kept literal) ─

const LANGUAGE_OPTIONS: { value: Language; labelKey: StringKey }[] = [
  { value: 'he', labelKey: 'lang.he' },
  { value: 'en', labelKey: 'lang.en' },
];
const languageLabelKey = (l: Language): StringKey => (l === 'he' ? 'lang.he' : 'lang.en');

const GOAL_OPTIONS: { value: ContentGoal; labelKey: StringKey; icon: string }[] = [
  { value: 'build_authority',   labelKey: 'goal.build_authority',   icon: 'star' },
  { value: 'generate_leads',    labelKey: 'goal.generate_leads',    icon: 'person_add' },
  { value: 'increase_sales',    labelKey: 'goal.increase_sales',    icon: 'trending_up' },
  { value: 'educate_audience',  labelKey: 'goal.educate_audience',  icon: 'school' },
  { value: 'grow_community',    labelKey: 'goal.grow_community',     icon: 'groups' },
  { value: 'personal_branding', labelKey: 'goal.personal_branding', icon: 'badge' },
  { value: 'other',             labelKey: 'goal.other',             icon: 'more_horiz' },
];

const STYLE_OPTIONS: { value: ContentStyle; labelKey: StringKey }[] = [
  { value: 'professional',  labelKey: 'style.professional' },
  { value: 'authoritative', labelKey: 'style.authoritative' },
  { value: 'friendly',      labelKey: 'style.friendly' },
  { value: 'personal',      labelKey: 'style.personal' },
  { value: 'journalistic',  labelKey: 'style.journalistic' },
  { value: 'provocative',   labelKey: 'style.provocative' },
  { value: 'humorous',      labelKey: 'style.humorous' },
  { value: 'other',         labelKey: 'style.other' },
];

const TARGET_OPTIONS: { value: ContentTarget; label: string; icon: string; beta?: boolean; subtitleKey?: StringKey }[] = [
  { value: 'linkedin',    label: 'LinkedIn',    icon: 'work' },
  { value: 'facebook',    label: 'Facebook',    icon: 'groups' },
  { value: 'newsletter',  label: 'Newsletter',  icon: 'email' },
  { value: 'podcast',     label: '🎙 Podcast',  icon: 'mic',  beta: true, subtitleKey: 'podcast.wizSubtitle' },
];

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; labelKey: StringKey; subKey: StringKey; icon: string }[] = [
  { value: 'manual',  labelKey: 'freq.manual',  subKey: 'freq.manual.sub',  icon: 'touch_app' },
  { value: 'daily',   labelKey: 'freq.daily',   subKey: 'freq.daily.sub',   icon: 'today' },
  { value: 'weekly',  labelKey: 'freq.weekly',  subKey: 'freq.weekly.sub',  icon: 'date_range' },
  { value: 'monthly', labelKey: 'freq.monthly', subKey: 'freq.monthly.sub', icon: 'calendar_month' },
];

const DAY_OF_WEEK_OPTIONS: { value: number; labelKey: StringKey }[] = [
  { value: 0, labelKey: 'dow.0' }, { value: 1, labelKey: 'dow.1' }, { value: 2, labelKey: 'dow.2' },
  { value: 3, labelKey: 'dow.3' }, { value: 4, labelKey: 'dow.4' }, { value: 5, labelKey: 'dow.5' },
  { value: 6, labelKey: 'dow.6' },
];

const STEP_KEYS: StringKey[] = ['wiz.step.goal', 'wiz.step.style', 'wiz.step.schedule'];

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
  const { t } = useT();
  return (
    <div className="space-y-6">
      <Input
        label={t('wiz.titleLabel')}
        type="text"
        value={form.title}
        onChange={e => update('title', e.target.value)}
        placeholder={t('wiz.titlePlaceholder')}
        autoFocus
      />

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">{t('wiz.outputLangLabel')}</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          {t('wiz.outputLangDesc')}
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
              {t(opt.labelKey)}
              {form.language === opt.value && <Icon name="check_circle" size="sm" className="text-primary ms-auto" filled />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">{t('wiz.goalLabel')}</label>
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
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        {form.contentGoal === 'other' && (
          <Input
            type="text"
            value={form.goalCustom}
            onChange={e => update('goalCustom', e.target.value)}
            placeholder={t('wiz.goalCustomPlaceholder')}
            className="mt-1"
          />
        )}
      </div>
    </div>
  );
}

// ── Step 2 — Content Style + Content Targets ──────────────

function Step2StyleTargets({ form, update }: { form: WizardFormData; update: UpdateFn }) {
  const { t } = useT();
  function toggleTarget(target: ContentTarget) {
    const next = form.contentTargets.includes(target)
      ? form.contentTargets.filter(x => x !== target)
      : [...form.contentTargets, target];
    update('contentTargets', next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">{t('wiz.styleLabel')}</label>
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
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        {form.contentStyle === 'other' && (
          <Input
            type="text"
            value={form.styleCustom}
            onChange={e => update('styleCustom', e.target.value)}
            placeholder={t('wiz.styleCustomPlaceholder')}
            className="mt-1"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">{t('wiz.targetsLabel')}</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          {t('wiz.targetsDesc')}
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
                  'flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all text-start',
                  selected
                    ? 'border-primary bg-secondary-container/40 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/30 hover:bg-surface-container',
                ].join(' ')}
              >
                <Icon name={opt.icon} size="sm" className={`${selected ? 'text-primary' : 'text-outline'} shrink-0 mt-0.5`} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-medium">{opt.label}</span>
                    {opt.beta && (
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
                        {t('podcast.betaBadge')}
                      </span>
                    )}
                  </span>
                  {opt.subtitleKey && (
                    <span className="block text-[11px] text-on-surface-variant mt-0.5 leading-relaxed font-normal line-clamp-2">
                      {t(opt.subtitleKey)}
                    </span>
                  )}
                </span>
                {selected && <Icon name="check_circle" size="sm" className="text-primary shrink-0 mt-0.5" filled />}
              </button>
            );
          })}
        </div>
        {form.contentTargets.length === 0 && (
          <p className="text-[12px] text-error">{t('wiz.targetsError')}</p>
        )}
      </div>
    </div>
  );
}

// ── Step 3 — Generate Schedule ────────────────────────────

function Step3Schedule({ form, update }: { form: WizardFormData; update: UpdateFn }) {
  const { t } = useT();
  const freq = form.scheduleFrequency;
  // Free plan blocks only 'daily' scheduling (manual/weekly/monthly are open on
  // every plan) — mirrors the backend's assertSchedulingAllowed for a proactive
  // UI hint only (backend stays authoritative).
  const dailyAllowed = useSchedulingAllowed('daily');
  const lockedFrequency = (v: WizardFormData['scheduleFrequency']) => v === 'daily' && !dailyAllowed;

  return (
    <div className="space-y-6">
      {/* Compact pre-creation summary of the chosen output language (no dedicated Review step). */}
      <div className="flex items-center gap-2 text-[13px] bg-surface-container rounded-lg px-3 py-2.5">
        <Icon name="translate" size="sm" className="text-primary" />
        <span className="text-on-surface-variant">{t('wiz.outputLangSummary')}</span>
        <span className="font-bold text-on-surface">{t(languageLabelKey(form.language))}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">{t('wiz.freqLabel')}</label>
        <p className="text-[12px] text-on-surface-variant -mt-1">
          {t('wiz.freqDescPre')} <strong>{t('wiz.generateNow')}</strong> {t('wiz.freqDescPost')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FREQUENCY_OPTIONS.map(opt => {
            const locked = lockedFrequency(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={locked}
                onClick={() => update('scheduleFrequency', opt.value)}
                title={locked ? 'Daily scheduling is available in LumAI Pro.' : undefined}
                className={[
                  'relative flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all',
                  locked ? 'opacity-50 cursor-not-allowed border-outline-variant' :
                  freq === opt.value
                    ? 'border-primary bg-secondary-container/40'
                    : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <Icon name={opt.icon} size="sm" className={freq === opt.value && !locked ? 'text-primary' : 'text-outline'} />
                  <span className={`text-[14px] font-bold ${freq === opt.value && !locked ? 'text-primary' : 'text-on-surface'}`}>{t(opt.labelKey)}</span>
                  {locked && <Icon name="lock" size="sm" className="text-outline ms-auto" />}
                </span>
                <span className="text-[11px] text-on-surface-variant">{locked ? 'Available in LumAI Pro' : t(opt.subKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional fields */}
      {freq !== 'manual' && (
        <div className="grid grid-cols-2 gap-4">
          {freq === 'weekly' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-on-surface-variant">{t('wiz.dayOfWeek')}</label>
              <select
                value={form.scheduleDayOfWeek}
                onChange={e => update('scheduleDayOfWeek', Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface"
              >
                {DAY_OF_WEEK_OPTIONS.map(d => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
              </select>
            </div>
          )}
          {freq === 'monthly' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-on-surface-variant">{t('wiz.dayOfMonth')}</label>
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
            <label className="text-[13px] font-medium text-on-surface-variant">{t('wiz.time')}</label>
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
          {t('wiz.manualNote')}
        </div>
      )}
    </div>
  );
}

// ── Wizard page ───────────────────────────────────────────

export function CreateCaseWizard() {
  const navigate = useNavigate();
  const { t } = useT();
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
  const caseLimitContent = useCaseLimitContent();
  const activeCaseLimitContent = useActiveCaseLimitContent();
  const showQuotaModal = useQuotaModalStore(s => s.show);
  const showActiveCaseLimitModal = useActiveCaseLimitModalStore(s => s.show);

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
    // Proactive: known-fresh usage says the limit is reached — open the modal
    // instead of sending a request we already know will be rejected. Prefer
    // the specific ActiveCaseLimitModal (real data about the one active case);
    // fall back to the generic QuotaLimitModal for the Pro/Master multi-case edge.
    if (activeCaseLimitContent) { showActiveCaseLimitModal({ mode: 'create', activeCase: activeCaseLimitContent.activeCase }); return; }
    if (caseLimitContent) { showQuotaModal(caseLimitContent); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const newCase = await createCase(form);
      navigate(`/cases/${newCase.id}`);
    } catch (err) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge (authStore.ts) already opened the same modal;
      // don't ALSO show a duplicate inline banner for it.
      if (isQuotaApiError(err)) return;
      setCreateError(err instanceof Error ? err.message : t('wiz.createError'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <TopBar
        title={t('wiz.title')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/cases')}>
            <Icon name="close" size="sm" />
            {t('wiz.cancel')}
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {STEP_KEYS.map((labelKey, i) => (
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
                    {t(labelKey)}
                  </span>
                </div>
                {i < STEP_KEYS.length - 1 && (
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
              {t('wiz.back')}
            </Button>

            {step < STEP_KEYS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                {t('wiz.next')}
                <Icon name="arrow_forward" size="sm" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!canNext || creating} loading={creating}>
                <Icon name="rocket_launch" size="sm" />
                {creating ? t('wiz.creating') : t('wiz.create')}
              </Button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
