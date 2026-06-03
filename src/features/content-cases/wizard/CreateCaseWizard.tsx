import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../../components/layout/TopBar';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { useContentCasesStore } from '../../../stores/contentCasesStore';
import type { WizardFormData } from '../../../types';
import { Step1Basics } from './Step1Basics';
import { Step2Audience } from './Step2Audience';
import { Step3WritingStyle } from './Step3WritingStyle';
import { Step4Sources } from './Step4Sources';
import { Step5Schedule } from './Step5Schedule';
import { Step6Review } from './Step6Review';

const STEPS = [
  { label: 'Basic Info',    icon: 'info' },
  { label: 'Audience',      icon: 'groups' },
  { label: 'Writing Style', icon: 'edit_note' },
  { label: 'Sources',       icon: 'article' },
  { label: 'Schedule',      icon: 'schedule' },
  { label: 'Review',        icon: 'checklist' },
];

const emptyForm: WizardFormData = {
  title: '',
  language: 'en',
  targetAudience: '',
  industry: '',
  experienceLevel: 'intermediate',
  writingStyle: '',
  goals: '',
  aiInstructions: '',
  sources: [],
  schedule: { frequency: 'manual', time: null, dayOfWeek: null, dayOfMonth: null },
};

export function CreateCaseWizard() {
  const navigate = useNavigate();
  const createCase = useContentCasesStore(s => s.createCase);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormData>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function update<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setCreateError(null); // clear any previous error on form change
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1);
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const newCase = await createCase(form);
      navigate(`/cases/${newCase.id}/pipeline`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create case. Please try again.';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  const stepProps = { form, update };

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
        <div className="max-w-3xl mx-auto">

          {/* Step indicators */}
          <div className="flex items-center mb-10">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={[
                    'flex flex-col items-center gap-1 group',
                    i < step ? 'cursor-pointer' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className={[
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                    i === step   ? 'bg-primary text-on-primary shadow-md scale-110' :
                    i < step     ? 'bg-green-500 text-white' :
                    'bg-surface-container text-outline',
                  ].join(' ')}>
                    {i < step
                      ? <Icon name="check" size="sm" />
                      : <Icon name={s.icon} size="sm" />
                    }
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-outline'}`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-10px] rounded-full transition-all ${i < step ? 'bg-green-400' : 'bg-outline-variant'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-8 min-h-[400px]">
            <h2 className="text-[22px] font-serif text-on-surface mb-1">{STEPS[step].label}</h2>
            <p className="text-[14px] text-on-surface-variant mb-6">Step {step + 1} of {STEPS.length}</p>

            {step === 0 && <Step1Basics {...stepProps} />}
            {step === 1 && <Step2Audience {...stepProps} />}
            {step === 2 && <Step3WritingStyle {...stepProps} />}
            {step === 3 && <Step4Sources {...stepProps} />}
            {step === 4 && <Step5Schedule {...stepProps} />}
            {step === 5 && <Step6Review form={form} onEdit={setStep} />}
          </div>

          {/* Error banner — shown when case creation fails */}
          {createError && (
            <div className="mt-4 flex items-start gap-3 bg-error-container/60 border border-error/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-error text-base shrink-0 mt-0.5">error</span>
              <p className="text-[13px] text-on-error-container">{createError}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
              <Icon name="arrow_back" size="sm" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={step === 0 && !form.title.trim()}>
                Next
                <Icon name="arrow_forward" size="sm" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!form.title.trim() || creating} loading={creating}>
                <Icon name="rocket_launch" size="sm" />
                {creating ? 'Creating…' : 'Create & Launch Pipeline'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
