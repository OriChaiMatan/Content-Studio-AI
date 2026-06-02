interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, id, label, description }: ToggleProps) {
  const toggleId = id ?? `toggle-${Math.random().toString(36).slice(2)}`;

  if (label) {
    return (
      <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors">
        <div className="flex flex-col">
          <span className="text-[16px] font-medium text-on-surface leading-6">{label}</span>
          {description && (
            <span className="text-[14px] text-on-surface-variant leading-5">{description}</span>
          )}
        </div>
        <ToggleSwitch id={toggleId} checked={checked} onChange={onChange} />
      </div>
    );
  }

  return <ToggleSwitch id={toggleId} checked={checked} onChange={onChange} />;
}

function ToggleSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        checked ? 'bg-secondary-container' : 'bg-outline-variant',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5 bg-primary' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
