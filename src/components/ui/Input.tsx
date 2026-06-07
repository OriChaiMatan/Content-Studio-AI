import { type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// ── Mixed-direction (Hebrew + English) free-text support ──────────────────────
// dir="auto"               → base direction from the first strong character
// unicode-bidi: plaintext  → base direction computed per line (for textareas)
// text-align: start        → alignment follows the resolved direction
// Applied to free-text fields only; URL/email/password/time/number/etc. keep
// their native LTR behavior.
const MIXED_DIR_STYLE: CSSProperties = { unicodeBidi: 'plaintext', textAlign: 'start' };

function isFreeTextType(type: string | undefined): boolean {
  // HTML default type is "text"; treat unset as free text. Everything else
  // (url, email, password, time, number, date, tel, …) is left untouched.
  return type === undefined || type === 'text' || type === 'search';
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, type, dir, style, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const freeText = isFreeTextType(type);
  const resolvedDir = dir ?? (freeText ? 'auto' : undefined);
  const resolvedStyle = freeText ? { ...MIXED_DIR_STYLE, ...style } : style;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[14px] font-medium text-on-surface-variant leading-5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        dir={resolvedDir}
        style={resolvedStyle}
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

export function Textarea({ label, error, className = '', id, dir, style, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  // All textareas hold free text → always mixed-direction aware.
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[14px] font-medium text-on-surface-variant leading-5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        dir={dir ?? 'auto'}
        style={{ ...MIXED_DIR_STYLE, ...style }}
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
