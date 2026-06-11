import { type ReactNode, type InputHTMLAttributes } from 'react';
import { Icon } from '../../components/ui/Icon';

// Phase 12 · Part 2 — shared editorial auth shell. Standalone public page (rendered
// OUTSIDE AppLayout/Sidebar). A single stable, centered container holds a two-column
// grid: a quiet editorial brand panel + a focused form column. Grid columns are
// minmax(0,1fr) (via min-w-0) so they can never collapse to content width — which was
// the desktop-collapse / word-by-word-wrap bug in the previous flex `lg:w-1/2` version.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-on-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 min-h-[640px] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">

        {/* ── Editorial brand panel (left) ─────────────────────────────── */}
        <aside className="hidden lg:flex min-w-0 flex-col justify-center gap-6 p-12 bg-surface-container-low border-r border-outline-variant">
          <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
            Intelligence Pipeline
          </span>
          <h1 className="font-serif text-[44px] leading-[1.12] text-on-surface">
            Many sources.<br />One thesis.<br />
            <span className="text-primary">Intelligent content.</span>
          </h1>
          <div className="w-12 h-1 rounded-full bg-primary" />
          <p className="max-w-[24rem] text-[16px] leading-7 text-on-surface-variant">
            Transform fragmented research into a single, defensible editorial thesis —
            then into platform-ready content. Built for rigor, not noise.
          </p>
        </aside>

        {/* ── Form column (right) ──────────────────────────────────────── */}
        <main className="min-w-0 flex flex-col justify-center p-8 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-[28rem] space-y-8">
            <div className="flex items-center gap-2">
              <Icon name="auto_stories" size="lg" className="text-primary" />
              <span className="font-serif text-[22px] font-bold tracking-tight text-primary">Content Studio AI</span>
            </div>
            {children}
          </div>
        </main>

      </div>
      <p className="mt-6 text-[11px] text-on-surface-variant/70">© {new Date().getFullYear()} Content Studio AI</p>
    </div>
  );
}

// Editorial form field: label-over-input in a hairline container whose bottom border
// lifts to the brand color on focus. Full-width, native, accessible, no form plugin.
interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightSlot?: ReactNode;
}
export function AuthField({ id, label, rightSlot, className = '', ...props }: AuthFieldProps) {
  return (
    <div className="group flex w-full flex-col rounded-t-lg border-b border-outline bg-surface-container-low px-3 pt-2 pb-1 transition-colors focus-within:border-b-2 focus-within:border-primary">
      <label htmlFor={id} className="text-[11px] font-medium tracking-[0.3px] text-on-surface-variant group-focus-within:text-primary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className={`min-w-0 flex-1 border-none bg-transparent py-1 text-[14px] text-on-surface outline-none placeholder:text-outline-variant focus:ring-0 ${className}`}
          {...props}
        />
        {rightSlot}
      </div>
    </div>
  );
}
