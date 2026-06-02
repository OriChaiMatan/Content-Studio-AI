import { type SelectHTMLAttributes } from 'react';
import type { SelectOption } from '../../types';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export function Select({ label, options, error, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-[14px] font-medium text-on-surface-variant leading-5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'bg-surface-container-low border-b border-outline text-[16px] text-on-surface px-2 py-2 font-sans appearance-none',
          'focus:border-b-2 focus:border-primary transition-all cursor-pointer',
          error ? 'border-error' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
