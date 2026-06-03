import type { WizardFormData, ScheduleFrequency } from '../../../types';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
}

const FREQUENCIES: { value: ScheduleFrequency; label: string; description: string; icon: string }[] = [
  { value: 'manual',  label: 'Manual',  description: 'Run the pipeline whenever you decide.',       icon: 'touch_app' },
  { value: 'daily',   label: 'Daily',   description: 'Automatically runs every day at a set time.', icon: 'today' },
  { value: 'weekly',  label: 'Weekly',  description: 'Runs once a week on a chosen day.',            icon: 'date_range' },
  { value: 'monthly', label: 'Monthly', description: 'Runs once a month on a chosen date.',          icon: 'calendar_month' },
];

export function Step5Schedule({ form, update }: Props) {
  const freq = form.schedule.frequency;

  function setFrequency(f: ScheduleFrequency) {
    update('schedule', { frequency: f, time: f !== 'manual' ? '09:00' : null, dayOfWeek: null, dayOfMonth: null });
  }

  return (
    <div className="space-y-6">
      <p className="text-[14px] text-on-surface-variant">
        Choose how often this content case should run its pipeline.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {FREQUENCIES.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFrequency(f.value)}
            className={[
              'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
              freq === f.value
                ? 'border-primary bg-secondary-container/40'
                : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container',
            ].join(' ')}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${freq === f.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'}`}>
              <Icon name={f.icon} size="sm" />
            </div>
            <div>
              <p className={`text-[14px] font-bold ${freq === f.value ? 'text-primary' : 'text-on-surface'}`}>{f.label}</p>
              <p className="text-[12px] text-on-surface-variant mt-0.5">{f.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Time picker (for non-manual) */}
      {freq !== 'manual' && (
        <div className="bg-surface-container-low rounded-xl p-5 space-y-4 border border-outline-variant/30">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-on-surface-variant">Time</label>
            <input
              type="time"
              value={form.schedule.time ?? '09:00'}
              onChange={e => update('schedule', { ...form.schedule, time: e.target.value })}
              className="bg-surface-container-lowest border-b border-outline text-[16px] text-on-surface px-2 py-2 font-sans w-40 focus:border-primary transition-all"
            />
          </div>

          {freq === 'weekly' && (
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-on-surface-variant">Day of Week</label>
              <div className="flex gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => update('schedule', { ...form.schedule, dayOfWeek: i })}
                    className={[
                      'w-10 h-10 rounded-lg text-[12px] font-bold transition-all',
                      form.schedule.dayOfWeek === i
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                    ].join(' ')}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === 'monthly' && (
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-on-surface-variant">Day of Month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.schedule.dayOfMonth ?? 1}
                onChange={e => update('schedule', { ...form.schedule, dayOfMonth: parseInt(e.target.value) })}
                className="bg-surface-container-lowest border-b border-outline text-[16px] text-on-surface px-2 py-2 font-sans w-24 focus:border-primary transition-all"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
