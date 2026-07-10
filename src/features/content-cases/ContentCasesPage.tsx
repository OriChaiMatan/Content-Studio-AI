import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, LifecycleBadge, PlatformBadge } from '../../components/ui/Badge';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import { Button } from '../../components/ui/Button';
// (I18n type for passing the translator into module-level helpers)
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useGoToNewCase, useActiveCaseLimitContent, buildCaseLimitInfo } from '../../hooks/useQuotaGate';
import { useActiveCaseLimitModalStore } from '../../stores/activeCaseLimitModalStore';
import { isQuotaApiError } from '../../lib/api';
import type { CaseStatus, ContentCase, ContentGoal, Platform, Schedule } from '../../types';

type I18n = ReturnType<typeof useT>;
const goalKey = (g: ContentGoal): StringKey => `goal.${g}` as StringKey;

const STATUS_FILTERS: { value: CaseStatus | 'all'; labelKey: StringKey }[] = [
  { value: 'all',       labelKey: 'cases.all' },
  { value: 'draft',     labelKey: 'status.case.draft' },
  { value: 'research',  labelKey: 'status.case.research' },
  { value: 'fact_check',labelKey: 'status.case.fact_check' },
  { value: 'generating',labelKey: 'status.case.generating' },
  { value: 'in_review', labelKey: 'status.case.in_review' },
  { value: 'completed', labelKey: 'status.case.completed' },
];

const IN_PROGRESS_STATUSES: CaseStatus[] = ['research', 'fact_check', 'generating'];

const statusProgress: Record<CaseStatus, number> = {
  draft: 0, research: 25, fact_check: 50, generating: 75, in_review: 90, completed: 100,
};

// ── Derived helpers (frontend-only — real output/source/run data) ─────────────

// Outputs belonging to the case's current/most-recent run (legacy fallback: all).
function runOutputs(c: ContentCase) {
  return c.currentRun ? c.outputs.filter(o => o.pipelineRunId === c.currentRun!.id) : c.outputs;
}

// Review-readiness is determined by ACTUAL pending draft outputs — never by
// case.status alone. A case can sit at status 'in_review' with every output
// already approved/rejected; that case has 0 pending drafts and is NOT in review.
function pendingDrafts(c: ContentCase): number {
  return runOutputs(c).filter(o => o.status === 'draft').length;
}

function platformsOf(c: ContentCase): Platform[] {
  return [...new Set(runOutputs(c).map(o => o.platform))];
}

// Intended platforms from the wizard (used before anything is generated).
// 'images' is a ContentTarget but not a Platform, so it's filtered out.
function plannedPlatforms(c: ContentCase): Platform[] {
  return c.contentTargets.filter((t): t is Platform => t !== 'images');
}

// goalCustom is USER content — never translated; enum goals use i18n keys.
function goalLabel(c: ContentCase, i18n: I18n): string {
  if (c.contentGoal === 'other' && c.goalCustom) return c.goalCustom;
  return i18n.t(goalKey(c.contentGoal));
}

function humanizeSchedule(s: Schedule, i18n: I18n): string {
  switch (s.frequency) {
    case 'manual':  return i18n.t('freq.manual');
    case 'daily':   return i18n.t('freq.daily') + (s.time ? ` · ${s.time}` : '');
    case 'weekly':  return `${i18n.t('freq.weekly')} · ${i18n.t(`dow.${s.dayOfWeek ?? 1}` as StringKey)}${s.time ? ` ${s.time}` : ''}`;
    case 'monthly': return `${i18n.t('freq.monthly')} · ${i18n.t('sched.dayOfMonth', { count: s.dayOfMonth ?? 1 })}${s.time ? ` ${s.time}` : ''}`;
    default:        return i18n.t('freq.manual');
  }
}

function relativeDate(iso: string, i18n: I18n): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return i18n.t('date.today');
  if (days === 1) return i18n.t('date.yesterday');
  if (days < 7)  return i18n.t('date.daysAgo', { count: days });
  return i18n.formatDate(iso);
}

// State-aware primary CTA — chosen from real state, in priority order.
interface CaseCta { labelKey: StringKey; icon: string; to: string; variant: 'primary' | 'secondary'; }
function caseCta(c: ContentCase): CaseCta {
  // Archived cases are read-only — no mutating CTA (add sources, review, etc.),
  // just a plain view link.
  if (c.lifecycleStatus === 'ARCHIVED')
    return { labelKey: 'cases.openCase', icon: 'visibility', to: `/cases/${c.id}`, variant: 'secondary' };
  if (pendingDrafts(c) > 0)
    return { labelKey: 'common.reviewContent', icon: 'rate_review', to: `/cases/${c.id}/review`, variant: 'primary' };
  if (IN_PROGRESS_STATUSES.includes(c.status))
    return { labelKey: 'cases.viewPipeline', icon: 'visibility', to: `/cases/${c.id}/pipeline`, variant: 'secondary' };
  if (c.sources.length === 0)
    return { labelKey: 'cases.addSources', icon: 'note_add', to: `/cases/${c.id}`, variant: 'primary' };
  return { labelKey: 'cases.openCase', icon: 'open_in_new', to: `/cases/${c.id}`, variant: 'secondary' };
}

// ── Overflow menu for an ARCHIVED card — keeps the card clean (a single
// kebab icon) while still surfacing "Reactivate" directly from the list.
// Reuses the exact same transactional reactivate flow and conflict modal as
// the Case Detail page (hooks/useQuotaGate.ts's useActiveCaseLimitContent,
// stores/activeCaseLimitModalStore) — no new modal, no duplicated lifecycle
// logic. Stays on the Content Cases page either way; the store update alone
// refreshes this page's filters/counts/badges (and Settings usage, via the
// store's own refreshUsage() call inside reactivateCase).
function ArchivedCardMenu({ c }: { c: ContentCase }) {
  const [open, setOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactivateCase = useContentCasesStore(s => s.reactivateCase);
  const activeCaseLimitContent = useActiveCaseLimitContent();
  const showActiveCaseLimitModal = useActiveCaseLimitModalStore(s => s.show);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function handleReactivate(e: ReactMouseEvent) {
    e.stopPropagation();
    setOpen(false);
    // Proactive: known-fresh usage already says the active-case limit is
    // reached — open the existing conflict modal instead of a doomed request.
    if (activeCaseLimitContent) {
      showActiveCaseLimitModal({
        mode: 'reactivate',
        activeCase: activeCaseLimitContent.activeCase,
        targetCase: buildCaseLimitInfo(c),
      });
      return;
    }
    setReactivating(true);
    setError(null);
    try {
      await reactivateCase(c.id);
    } catch (err) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge already opened the conflict/quota modal.
      if (isQuotaApiError(err)) return;
      setError('Failed to reactivate. Please try again.');
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="more_vert" size="sm" />
      </button>
      {open && (
        <div role="menu" className="absolute z-20 end-0 mt-1 min-w-[160px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-xl py-1">
          <button
            role="menuitem"
            onClick={handleReactivate}
            disabled={reactivating}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 disabled:opacity-50 text-start"
          >
            <Icon name="unarchive" size="sm" />
            {reactivating ? 'Reactivating…' : 'Reactivate'}
          </button>
          {error && <p className="px-3 pt-1 pb-2 text-[11.5px] text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function ContentCasesPage() {
  const navigate = useNavigate();
  const i18n = useT();
  const { t, plural } = i18n;
  const cases   = useContentCasesStore(s => s.cases);
  const loading = useContentCasesStore(s => s.loading);
  const goToNewCase = useGoToNewCase(navigate);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  // Lifecycle (ACTIVE/ARCHIVED) is orthogonal to pipeline status — a case can be
  // Active + in_review at once — so it's a separate filter dimension, entirely
  // client-side (the full case list is already loaded; no new API param needed).
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [query, setQuery] = useState('');

  // Status match — 'in_review' uses REAL pending drafts, not case.status.
  function matchesStatus(c: ContentCase): boolean {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in_review') return pendingDrafts(c) > 0;
    return c.status === statusFilter;
  }

  function matchesLifecycle(c: ContentCase): boolean {
    if (lifecycleFilter === 'all') return true;
    if (lifecycleFilter === 'active') return c.lifecycleStatus === 'ACTIVE';
    return c.lifecycleStatus === 'ARCHIVED';
  }

  // Pill count — same output-accurate logic for 'in_review'.
  function countFor(value: CaseStatus): number {
    if (value === 'in_review') return cases.filter(c => pendingDrafts(c) > 0).length;
    return cases.filter(c => c.status === value).length;
  }

  const activeCount   = cases.filter(c => c.lifecycleStatus === 'ACTIVE').length;
  const archivedCount = cases.filter(c => c.lifecycleStatus === 'ARCHIVED').length;

  const filtered = cases
    .filter(c => {
      if (!matchesStatus(c)) return false;
      if (!matchesLifecycle(c)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.industry.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    // In the combined "All" view, active cases lead, archived trail — each group
    // keeps the backend's updatedAt-desc order (stable sort). Single-lifecycle
    // views (Active/Archived) are already homogeneous, so this is a no-op there.
    .sort((a, b) => (a.lifecycleStatus === 'ARCHIVED' ? 1 : 0) - (b.lifecycleStatus === 'ARCHIVED' ? 1 : 0));

  return (
    <>
      <TopBar
        title={t('nav.cases')}
        searchPlaceholder={t('cases.searchPlaceholder')}
        onSearch={setQuery}
        actions={
          <Button onClick={goToNewCase}>
            <Icon name="add" size="sm" />
            {t('cases.newCaseShort')}
          </Button>
        }
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Loading state */}
        {loading && cases.length === 0 && (
          <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">refresh</span>
            <span className="text-[14px]">{t('cases.loading')}</span>
          </div>
        )}

        {/* Lifecycle filter chips — All / Active / Archived (orthogonal to pipeline status) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            { value: 'all' as const,      label: 'All',      count: cases.length },
            { value: 'active' as const,   label: 'Active',   count: activeCount },
            { value: 'archived' as const, label: 'Archived', count: archivedCount },
          ]).map(f => (
            <button
              key={f.value}
              onClick={() => setLifecycleFilter(f.value)}
              className={[
                'px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors',
                lifecycleFilter === f.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
              ].join(' ')}
            >
              {f.label}
              <span className="ml-1.5 text-[11px] opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={[
                'px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
              ].join(' ')}
            >
              {t(f.labelKey)}
              {f.value !== 'all' && (
                <span className="ml-1.5 text-[11px] opacity-70">
                  ({countFor(f.value)})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cases grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
              <Icon name="folder_open" size="xl" className="text-outline" />
            </div>
            <p className="text-[16px] font-medium text-on-surface-variant">{t('cases.empty')}</p>
            <p className="text-[14px] text-outline mt-1">{t('cases.emptyHint')}</p>
            <Button className="mt-6" onClick={goToNewCase}>
              <Icon name="add" size="sm" />
              {t('common.newCase')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(c => {
              const progress       = statusProgress[c.status];
              const currentOutputs = runOutputs(c);
              const approvedCount  = currentOutputs.filter(o => o.status === 'approved').length;
              const generated      = platformsOf(c);
              const planned        = generated.length === 0 ? plannedPlatforms(c) : [];
              const platforms      = generated.length > 0 ? generated : planned;
              const ranAt          = c.currentRun?.completedAt ?? null;
              const cta            = caseCta(c);

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Status progress bar */}
                  <div className="h-1 bg-surface-container-high">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[16px] font-medium text-on-surface truncate">{c.title}</h3>
                        <p className="text-[12px] text-on-surface-variant mt-0.5 truncate">{goalLabel(c, i18n)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <LifecycleBadge status={c.lifecycleStatus} />
                        <CaseStatusBadge status={c.status} />
                        {c.lifecycleStatus === 'ARCHIVED' && <ArchivedCardMenu c={c} />}
                      </div>
                    </div>

                    {/* Platforms */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4 min-h-[20px]">
                      {platforms.length > 0 ? (
                        <>
                          {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                          {planned.length > 0 && (
                            <span className="text-[10px] uppercase tracking-wide text-outline">{t('cases.planned')}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[12px] text-outline">{t('cases.noPlatforms')}</span>
                      )}
                    </div>

                    {/* Approval progress */}
                    {currentOutputs.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
                          <span>{t('cases.approval')}</span>
                          <span>{t('cases.approvedCount', { approved: approvedCount, total: currentOutputs.length })}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${(approvedCount / currentOutputs.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-[12px] text-on-surface-variant border-t border-outline-variant/30 pt-3">
                      <span className="flex items-center gap-1">
                        <Icon name="article" size="sm" className="text-outline" />
                        {plural(c.sources.length, 'count.sources.one', 'count.sources.other')}
                      </span>
                      <span className="flex items-center gap-1 min-w-0">
                        <Icon name="schedule" size="sm" className="text-outline" />
                        <span className="truncate">{humanizeSchedule(c.schedule, i18n)}</span>
                      </span>
                    </div>

                    {/* Last updated / last run */}
                    <p className="text-[11px] text-outline mt-2">
                      {ranAt ? t('cases.lastRun', { date: relativeDate(ranAt, i18n) }) : t('cases.updated', { date: relativeDate(c.updatedAt, i18n) })}
                    </p>

                    {/* Always-visible primary CTA */}
                    <div className="mt-4 pt-1">
                      <Button
                        size="sm"
                        fullWidth
                        variant={cta.variant}
                        onClick={e => { e.stopPropagation(); navigate(cta.to); }}
                      >
                        <Icon name={cta.icon} size="sm" />
                        {t(cta.labelKey)}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New case tile — intentional, primary-tinted affordance */}
            <button
              type="button"
              onClick={goToNewCase}
              className="group border-2 border-dashed border-outline-variant rounded-xl p-5 flex flex-col items-center justify-center gap-3 transition-colors min-h-[200px] hover:border-primary hover:bg-primary-container/20"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center text-outline transition-colors">
                <Icon name="add" size="lg" />
              </div>
              <p className="text-[14px] font-medium text-on-surface-variant group-hover:text-primary transition-colors">
                {t('common.newCase')}
              </p>
              <p className="text-[12px] text-outline">
                {t('cases.newTileSub')}
              </p>
            </button>
          </div>
        )}
      </main>
    </>
  );
}
