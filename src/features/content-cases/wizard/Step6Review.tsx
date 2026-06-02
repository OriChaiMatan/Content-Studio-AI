import { Icon } from '../../../components/ui/Icon';
import type { WizardFormData } from '../../../types';

interface Props {
  form: WizardFormData;
  onEdit: (step: number) => void;
}

interface SectionProps {
  title: string;
  icon: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}

function ReviewSection({ title, icon, step, onEdit, children }: SectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="text-outline" size="sm" />
          <h4 className="text-[13px] font-bold uppercase tracking-wider text-on-surface-variant">{title}</h4>
        </div>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-[12px] text-primary font-medium hover:text-primary/80 flex items-center gap-1"
        >
          <Icon name="edit" size="sm" />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[12px] text-outline min-w-[100px] shrink-0">{label}</span>
      <span className="text-[13px] text-on-surface">{value || '—'}</span>
    </div>
  );
}

export function Step6Review({ form, onEdit }: Props) {
  const scheduleText = form.schedule.frequency === 'manual'
    ? 'Manual'
    : `${form.schedule.frequency.charAt(0).toUpperCase() + form.schedule.frequency.slice(1)} at ${form.schedule.time}`;

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-on-surface-variant mb-2">
        Review your settings before creating the case. Click any section to edit.
      </p>

      <ReviewSection title="Basic Info" icon="info" step={0} onEdit={onEdit}>
        <Row label="Case Name" value={form.title} />
        <Row label="Language"  value={form.language === 'en' ? 'English (US)' : 'Hebrew (עברית)'} />
      </ReviewSection>

      <ReviewSection title="Audience" icon="groups" step={1} onEdit={onEdit}>
        <Row label="Target"    value={form.targetAudience} />
        <Row label="Industry"  value={form.industry} />
        <Row label="Level"     value={form.experienceLevel} />
      </ReviewSection>

      <ReviewSection title="Writing Style" icon="edit_note" step={2} onEdit={onEdit}>
        <Row label="Style"       value={form.writingStyle} />
        <Row label="Goals"       value={form.goals} />
        <Row label="AI Notes"    value={form.aiInstructions} />
      </ReviewSection>

      <ReviewSection title="Sources" icon="article" step={3} onEdit={onEdit}>
        {form.sources.length === 0 ? (
          <p className="text-[13px] text-outline">No sources added.</p>
        ) : (
          <div className="space-y-1">
            {form.sources.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-1.5 py-0.5 rounded">{s.type}</span>
                <span className="text-[13px] text-on-surface truncate">{s.label || s.content}</span>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      <ReviewSection title="Schedule" icon="schedule" step={4} onEdit={onEdit}>
        <Row label="Frequency" value={scheduleText} />
      </ReviewSection>

      {/* Launch notice */}
      <div className="flex items-start gap-3 bg-primary-fixed/30 rounded-xl p-4 border border-primary/20">
        <Icon name="rocket_launch" className="text-primary shrink-0" />
        <div>
          <p className="text-[14px] font-medium text-on-surface">Clicking "Create & Launch Pipeline" will:</p>
          <ul className="text-[13px] text-on-surface-variant mt-1 space-y-0.5 list-disc list-inside">
            <li>Create the content case</li>
            <li>Start the Research step immediately</li>
            <li>Navigate to the Pipeline view</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
