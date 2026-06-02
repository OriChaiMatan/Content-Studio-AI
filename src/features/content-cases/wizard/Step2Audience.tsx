import { Input } from '../../../components/ui/Input';
import type { WizardFormData, ExperienceLevel } from '../../../types';

interface Props {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
}

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner',     label: 'Beginner',     description: 'New to the topic, needs simple explanations' },
  { value: 'intermediate', label: 'Intermediate', description: 'Some familiarity, can handle nuance' },
  { value: 'expert',       label: 'Expert',       description: 'Deep domain knowledge, values precision' },
];

export function Step2Audience({ form, update }: Props) {
  return (
    <div className="space-y-6">
      <Input
        label="Target Audience *"
        type="text"
        value={form.targetAudience}
        onChange={e => update('targetAudience', e.target.value)}
        placeholder="e.g. Logistics executives at Fortune 500 companies"
      />
      <Input
        label="Industry"
        type="text"
        value={form.industry}
        onChange={e => update('industry', e.target.value)}
        placeholder="e.g. Technology & Logistics"
      />

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Experience Level</label>
        <div className="grid grid-cols-3 gap-3 mt-1">
          {EXPERIENCE_LEVELS.map(level => (
            <label
              key={level.value}
              className={[
                'flex flex-col gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all',
                form.experienceLevel === level.value
                  ? 'border-primary bg-secondary-container/40'
                  : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <input
                type="radio"
                name="experienceLevel"
                value={level.value}
                checked={form.experienceLevel === level.value}
                onChange={() => update('experienceLevel', level.value)}
                className="hidden"
              />
              <p className={`text-[14px] font-bold ${form.experienceLevel === level.value ? 'text-primary' : 'text-on-surface'}`}>
                {level.label}
              </p>
              <p className="text-[12px] text-on-surface-variant">{level.description}</p>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
