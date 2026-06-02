import { Input } from '../../../components/ui/Input';
import type { WizardFormData, Language } from '../../../types';

interface Props {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
}

export function Step1Basics({ form, update }: Props) {
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

      <div className="flex flex-col gap-1">
        <label className="text-[14px] font-medium text-on-surface-variant">Language *</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          {([
            { value: 'en', label: 'English (US)', sub: 'Left-to-right' },
            { value: 'he', label: 'Hebrew (עברית)', sub: 'Right-to-left' },
          ] as { value: Language; label: string; sub: string }[]).map(lang => (
            <label
              key={lang.value}
              className={[
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                form.language === lang.value
                  ? 'border-primary bg-secondary-container/40 text-on-secondary-container'
                  : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
              ].join(' ')}
            >
              <input
                type="radio"
                name="language"
                value={lang.value}
                checked={form.language === lang.value}
                onChange={() => update('language', lang.value)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${form.language === lang.value ? 'border-primary' : 'border-outline-variant'}`}>
                {form.language === lang.value && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-[14px] font-medium">{lang.label}</p>
                <p className="text-[12px] text-on-surface-variant">{lang.sub}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
