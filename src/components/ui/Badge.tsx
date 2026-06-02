import type { Platform, CaseStatus, OutputStatus } from '../../types';

// ── Platform badge ─────────────────────────────────────────

const platformLabels: Record<Platform, string> = {
  linkedin:     'LinkedIn',
  facebook:     'Facebook',
  instagram:    'Instagram',
  newsletter:   'Newsletter',
  podcast:      'Podcast',
  image_prompt: 'Image Prompt',
};

const platformColors: Record<Platform, string> = {
  linkedin:     'bg-secondary-container/60 text-on-secondary-container',
  facebook:     'bg-primary-fixed/60 text-on-primary-fixed',
  instagram:    'bg-tertiary-fixed/60 text-on-tertiary-fixed',
  newsletter:   'bg-tertiary-container/30 text-on-tertiary-container',
  podcast:      'bg-secondary-container/60 text-on-secondary-container',
  image_prompt: 'bg-surface-variant text-on-surface-variant',
};

interface PlatformBadgeProps { platform: Platform; }

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${platformColors[platform]}`}>
      {platformLabels[platform]}
    </span>
  );
}

// ── Status badge ───────────────────────────────────────────

const outputStatusConfig: Record<OutputStatus, { label: string; color: string; icon: string }> = {
  draft:    { label: 'Draft',    color: 'text-outline',  icon: 'edit_note' },
  approved: { label: 'Approved', color: 'text-primary',  icon: 'check_circle' },
  rejected: { label: 'Rejected', color: 'text-error',    icon: 'cancel' },
};

interface OutputStatusBadgeProps { status: OutputStatus; }

export function OutputStatusBadge({ status }: OutputStatusBadgeProps) {
  const cfg = outputStatusConfig[status];
  return (
    <div className={`flex items-center gap-1 font-bold text-xs ${cfg.color}`}>
      <span className="material-symbols-outlined text-base">{cfg.icon}</span>
      <span>{cfg.label}</span>
    </div>
  );
}

// ── Case status badge ──────────────────────────────────────

const caseStatusConfig: Record<CaseStatus, { label: string; bg: string; text: string }> = {
  draft:         { label: 'Draft',          bg: 'bg-surface-variant',         text: 'text-on-surface-variant' },
  research:      { label: 'Researching',    bg: 'bg-primary-fixed/60',         text: 'text-on-primary-fixed' },
  fact_check:    { label: 'Fact Checking',  bg: 'bg-secondary-container/60',   text: 'text-on-secondary-container' },
  generating:    { label: 'Generating',     bg: 'bg-tertiary-fixed/60',        text: 'text-on-tertiary-fixed' },
  in_review:     { label: 'In Review',      bg: 'bg-secondary-container',      text: 'text-on-secondary-container' },
  completed:     { label: 'Completed',      bg: 'bg-primary-fixed/60',         text: 'text-primary' },
};

interface CaseStatusBadgeProps { status: CaseStatus; }

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const cfg = caseStatusConfig[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
