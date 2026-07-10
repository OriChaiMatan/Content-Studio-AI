import type { Platform, CaseStatus, CaseLifecycleStatus, OutputStatus } from '../../types';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';

// ── Platform badge ─────────────────────────────────────────

const platformLabels: Record<Platform, string> = {
  linkedin:     'LinkedIn',
  facebook:     'Facebook',
  newsletter:   'Newsletter',
  podcast:      'Podcast',
};

const platformColors: Record<Platform, string> = {
  linkedin:     'bg-secondary-container/60 text-on-secondary-container',
  facebook:     'bg-primary-fixed/60 text-on-primary-fixed',
  newsletter:   'bg-tertiary-container/30 text-on-tertiary-container',
  podcast:      'bg-secondary-container/60 text-on-secondary-container',
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

const outputStatusConfig: Record<OutputStatus, { labelKey: StringKey; color: string; icon: string }> = {
  draft:    { labelKey: 'status.output.draft',    color: 'text-outline',  icon: 'edit_note' },
  approved: { labelKey: 'status.output.approved', color: 'text-primary',  icon: 'check_circle' },
  rejected: { labelKey: 'status.output.rejected', color: 'text-error',    icon: 'cancel' },
};

interface OutputStatusBadgeProps { status: OutputStatus; }

export function OutputStatusBadge({ status }: OutputStatusBadgeProps) {
  const { t } = useT();
  const cfg = outputStatusConfig[status];
  return (
    <div className={`flex items-center gap-1 font-bold text-xs ${cfg.color}`}>
      <span className="material-symbols-outlined text-base">{cfg.icon}</span>
      <span>{t(cfg.labelKey)}</span>
    </div>
  );
}

// ── Case status badge ──────────────────────────────────────

const caseStatusConfig: Record<CaseStatus, { labelKey: StringKey; bg: string; text: string }> = {
  draft:         { labelKey: 'status.case.draft',      bg: 'bg-surface-variant',         text: 'text-on-surface-variant' },
  research:      { labelKey: 'status.case.research',   bg: 'bg-primary-fixed/60',         text: 'text-on-primary-fixed' },
  fact_check:    { labelKey: 'status.case.fact_check', bg: 'bg-secondary-container/60',   text: 'text-on-secondary-container' },
  generating:    { labelKey: 'status.case.generating', bg: 'bg-tertiary-fixed/60',        text: 'text-on-tertiary-fixed' },
  in_review:     { labelKey: 'status.case.in_review',  bg: 'bg-secondary-container',      text: 'text-on-secondary-container' },
  completed:     { labelKey: 'status.case.completed',  bg: 'bg-primary-fixed/60',         text: 'text-primary' },
};

interface CaseStatusBadgeProps { status: CaseStatus; }

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const { t } = useT();
  const cfg = caseStatusConfig[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {t(cfg.labelKey)}
    </span>
  );
}

// ── Lifecycle badge (ACTIVE / ARCHIVED) ────────────────────
// Independent of CaseStatus (pipeline progress) — see ContentCase.lifecycleStatus.
// By default renders nothing for ACTIVE (the unremarkable default state, and the
// Content Cases list already has All/Active/Archived filter chips, so a per-card
// ACTIVE badge there would be redundant clutter) — only ARCHIVED gets a visible,
// muted pill there. Case Detail passes `alwaysShow` since the page must clearly
// state ACTIVE or ARCHIVED regardless.
interface LifecycleBadgeProps { status: CaseLifecycleStatus; alwaysShow?: boolean; }

export function LifecycleBadge({ status, alwaysShow = false }: LifecycleBadgeProps) {
  if (status !== 'ARCHIVED' && !alwaysShow) return null;
  const isArchived = status === 'ARCHIVED';
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
        isArchived ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary-container text-on-primary-container'
      }`}
    >
      {isArchived ? 'Archived' : 'Active'}
    </span>
  );
}
