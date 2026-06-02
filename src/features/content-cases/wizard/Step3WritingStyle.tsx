import { Input, Textarea } from '../../../components/ui/Input';
import type { WizardFormData } from '../../../types';

interface Props {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
}

const STYLE_PRESETS = [
  'Authoritative and data-driven',
  'Conversational and accessible',
  'Balanced and journalistic',
  'Passionate and solutions-focused',
  'Technical and precise',
];

export function Step3WritingStyle({ form, update }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-medium text-on-surface-variant">Writing Style</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {STYLE_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => update('writingStyle', preset)}
              className={[
                'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all',
                form.writingStyle === preset
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/50 hover:bg-surface-container',
              ].join(' ')}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          type="text"
          value={form.writingStyle}
          onChange={e => update('writingStyle', e.target.value)}
          placeholder="Or describe a custom style..."
        />
      </div>

      <Textarea
        label="Content Goals"
        value={form.goals}
        onChange={e => update('goals', e.target.value)}
        placeholder="What should this content achieve? e.g. Position our team as thought leaders, drive newsletter signups..."
        rows={3}
      />

      <Textarea
        label="AI Instructions"
        value={form.aiInstructions}
        onChange={e => update('aiInstructions', e.target.value)}
        placeholder="Any specific instructions for the AI? e.g. Avoid excessive jargon. Always cite sources. Use active voice..."
        rows={4}
      />
    </div>
  );
}
