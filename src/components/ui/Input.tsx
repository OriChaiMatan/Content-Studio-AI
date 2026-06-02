import { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[14px] font-medium text-on-surface-variant leading-5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'bg-surface-container-low border-b border-outline text-[16px] text-on-surface px-2 py-2 font-sans',
          'focus:border-b-2 focus:border-primary transition-all',
          error ? 'border-error' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[14px] font-medium text-on-surface-variant leading-5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={[
          'bg-surface-container-low border border-outline-variant rounded-lg text-[14px] text-on-surface px-3 py-2 font-sans resize-y min-h-[100px]',
          'focus:border-primary focus:border-2 transition-all',
          error ? 'border-error' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
