import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { LumaiLogoChip } from '../../components/ui/LumaiLogo';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGoToNewCase } from '../../hooks/useQuotaGate';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import type { CaseStatus, ContentCase, Platform, Schedule } from '../../types';

type I18n = ReturnType<typeof useT>;

// ── Derived helpers (frontend-only — no backend fields invented) ──────────────

const IN_PROGRESS_STATUSES: CaseStatus[] = ['research', 'fact_check', 'generating'];

// Outputs that belong to the case's current/most-recent run (falls back to all
// outputs for legacy cases without a currentRun).
function runOutputs(c: ContentCase) {
  return c.currentRun ? c.outputs.filter(o => o.pipelineRunId === c.currentRun!.id) : c.outputs;
}

function pendingDraftsOf(c: ContentCase): number {
  return runOutputs(c).filter(o => o.status === 'draft').length;
}

function platformsOf(c: ContentCase): Platform[] {
  return [...new Set(runOutputs(c).map(o => o.platform))];
}

function sourceCountOf(c: ContentCase): number {
  return c.currentRun?.sourceCount ?? c.sources.length;
}

// Latest run timestamp (completed if available, else started). Null when the
// case has never run.
function runTimestamp(c: ContentCase): string | null {
  return c.currentRun?.completedAt ?? c.currentRun?.startedAt ?? null;
}

// Compose a localized schedule label from i18n parts (freq + day + time).
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

function greetingKey(): StringKey {
  const h = new Date().getHours();
  if (h < 12) return 'dash.greetMorning';
  if (h < 18) return 'dash.greetAfternoon';
  return 'dash.greetEvening';
}

const pipelineStatusLabel: Record<CaseStatus, StringKey> = {
  draft:       'dash.psl.draft',
  research:    'dash.psl.research',
  fact_check:  'dash.psl.fact_check',
  generating:  'dash.psl.generating',
  in_review:   'dash.psl.in_review',
  completed:   'dash.psl.completed',
};

const pipelineStatusIcon: Record<CaseStatus, string> = {
  draft:       'pending',
  research:    'search',
  fact_check:  'fact_check',
  generating:  'auto_awesome',
  in_review:   'rate_review',
  completed:   'check_circle',
};

// ── KPI card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  sub: string;
  accent?: string;
  urgent?: boolean;
  live?: boolean;
  onClick?: () => void;
}

function StatCard({ icon, label, value, sub, accent = 'bg-primary', urgent, live, onClick }: StatCardProps) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'text-left bg-surface-container-lowest rounded-xl p-6 shadow-sm border flex items-start gap-4 w-full transition-all',
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default',
        urgent ? 'border-l-4 border-l-green-400 border-outline-variant/30' : 'border-outline-variant/30',
      ].join(' ')}
    >
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center text-on-primary shrink-0`}>
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase font-bold text-outline tracking-wider mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-[32px] font-serif text-on-surface leading-none">{value}</p>
          {live && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              {t('dash.live')}
            </span>
          )}
        </div>
        <p className="text-[12px] text-on-surface-variant mt-1">{sub}</p>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const i18n = useT();
  const { t, plural, formatDateTime } = i18n;
  const cases       = useContentCasesStore(s => s.cases);
  const loading     = useContentCasesStore(s => s.loading);
  const libraryRuns = useLibraryStore(s => s.runs);
  const user        = useSettingsStore(s => s.user);
  const goToNewCase = useGoToNewCase(navigate);

  // "Needs review" is determined by ACTUAL pending draft outputs in the current
  // run — NOT by case.status. A case can sit at status 'in_review' while all its
  // outputs are already approved/rejected; such a case has 0 pending drafts and
  // must not appear here. Reads live output statuses straight from the store, so
  // approving/rejecting on the review page removes the case once drafts hit 0.
  const reviewCases   = cases.filter(c => pendingDraftsOf(c) > 0);
  const progressCases = cases.filter(c => IN_PROGRESS_STATUSES.includes(c.status));
  const activeCases   = cases.filter(c => c.lifecycleStatus === 'ACTIVE').length;
  const approved      = libraryRuns.reduce((n, r) => n + r.approvedCount, 0);
  const recentCases   = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const inReview   = reviewCases.length;
  const inProgress = progressCases.length;
  const pendingDraftsTotal = reviewCases.reduce((n, c) => n + pendingDraftsOf(c), 0);
  // Simple, safe heuristic: a case that hasn't started and has no sources yet.
  const needsSources = cases.filter(c => c.status === 'draft' && c.sources.length === 0).length;

  const firstName = user.name.split(' ')[0];

  // ── Priority summary — "what needs my attention right now?" ──
  let priorityText: string;
  let priorityAction: (() => void) | null = null;
  let priorityActionLabel = '';
  if (inReview > 0) {
    const n = pendingDraftsTotal || inReview;
    priorityText = pendingDraftsTotal
      ? plural(n, 'dash.priDrafts.one', 'dash.priDrafts.other')
      : plural(n, 'dash.priReview.one', 'dash.priReview.other');
    priorityAction = () => navigate(`/cases/${reviewCases[0].id}/review`);
    priorityActionLabel = t('dash.reviewNow');
  } else if (needsSources > 0) {
    priorityText = plural(needsSources, 'dash.priSources.one', 'dash.priSources.other');
  } else if (inProgress > 0) {
    priorityText = plural(inProgress, 'dash.priGen.one', 'dash.priGen.other');
  } else {
    priorityText = t('dash.priClear');
  }

  // ── Loading ──
  if (loading && cases.length === 0) {
    return (
      <>
        <TopBar title={t('nav.dashboard')} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">refresh</span>
            <span className="text-[14px]">{t('dash.loading')}</span>
          </div>
        </main>
      </>
    );
  }

  // ── First-use empty state (single CTA — no welcome header leak) ──
  if (cases.length === 0) {
    return (
      <>
        <TopBar title={t('nav.dashboard')} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <LumaiLogoChip box={80} className="mb-6 rounded-2xl" />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary mb-2">{t('brand.subtitle')}</p>
            <h3 className="text-[22px] font-serif text-on-surface mb-3">{t('dash.welcomeTitle')}</h3>
            <p className="text-[14px] text-on-surface-variant mb-8 leading-relaxed">
              {t('dash.welcomeBody')}
            </p>
            <Button onClick={goToNewCase} size="lg">
              <Icon name="add" size="sm" />
              {t('dash.createFirst')}
            </Button>
          </div>
        </main>
      </>
    );
  }

  // ── Populated dashboard ──
  return (
    <>
      <TopBar title={t('nav.dashboard')} />

      <main className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">

        {/* A. Smart header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-[22px] font-serif text-on-surface">
              {t(greetingKey())}, {firstName}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Icon
                name={inReview > 0 ? 'priority_high' : inProgress > 0 ? 'autorenew' : 'check_circle'}
                size="sm"
                className={inReview > 0 ? 'text-green-600' : inProgress > 0 ? 'text-tertiary' : 'text-outline'}
              />
              <p className="text-[15px] text-on-surface">{priorityText}</p>
              {priorityAction && (
                <button
                  type="button"
                  onClick={priorityAction}
                  className="text-[14px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {priorityActionLabel} →
                </button>
              )}
            </div>
          </div>
          <Button
            variant={inReview > 0 ? 'ghost' : 'primary'}
            onClick={goToNewCase}
          >
            <Icon name="add" size="sm" />
            {t('common.newCase')}
          </Button>
        </div>

        {/* B. KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon="rate_review"
            label={t('dash.kpiReview')}
            value={inReview}
            sub={inReview > 0 ? plural(inReview, 'dash.kpiReviewSub.one', 'dash.kpiReviewSub.other') : t('dash.allCaughtUp')}
            accent="bg-secondary"
            urgent={inReview > 0}
            onClick={inReview > 0 ? () => navigate(`/cases/${reviewCases[0].id}/review`) : undefined}
          />
          <StatCard
            icon="folder_open"
            label={t('dash.kpiActive')}
            value={activeCases}
            sub={t('dash.kpiActiveSub')}
            onClick={() => navigate('/cases')}
          />
          <StatCard
            icon="auto_awesome"
            label={t('dash.kpiInProgress')}
            value={inProgress}
            sub={inProgress > 0 ? t('dash.pipelineRunning') : t('dash.nothingRunning')}
            accent="bg-tertiary"
            live={inProgress > 0}
            onClick={() => navigate('/cases')}
          />
          <StatCard
            icon="auto_stories"
            label={t('dash.kpiApproved')}
            value={approved}
            sub={t('dash.kpiApprovedSub')}
            accent="bg-primary-container"
            onClick={() => navigate('/library')}
          />
        </div>

        {/* C. Needs Your Review */}
        <section>
          <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">
            {t('dash.needsReview')}
          </h4>

          {reviewCases.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <Icon name="check_circle" className="text-green-600" />
              </div>
              <p className="text-[15px] font-medium text-on-surface">{t('dash.nothingWaiting')}</p>
              <p className="text-[13px] text-on-surface-variant mt-1">
                {t('dash.nothingWaitingSub')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviewCases.map(c => {
                const platforms = platformsOf(c);
                const pending   = pendingDraftsOf(c);
                const sources   = sourceCountOf(c);
                const ranAt     = runTimestamp(c);
                return (
                  <div
                    key={c.id}
                    className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 border-l-4 border-l-green-400 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
                    onClick={() => navigate(`/cases/${c.id}/review`)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h5 className="text-[16px] font-medium text-on-surface min-w-0 truncate">{c.title}</h5>
                      <CaseStatusBadge status={c.status} />
                    </div>

                    {/* Platforms generated */}
                    {platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                      </div>
                    )}

                    {/* Run meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-on-surface-variant mb-4">
                      <span className="flex items-center gap-1">
                        <Icon name="edit_note" size="sm" />
                        {plural(pending, 'dash.draftsPending.one', 'dash.draftsPending.other')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="article" size="sm" />
                        {plural(sources, 'count.sources.one', 'count.sources.other')}
                      </span>
                      {ranAt && (
                        <span className="flex items-center gap-1">
                          <Icon name="schedule" size="sm" />
                          {formatDateTime(ranAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/cases/${c.id}/review`); }}>
                        <Icon name="rate_review" size="sm" />
                        {t('common.reviewContent')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* D. Active Pipeline */}
        {inProgress > 0 && (
          <section>
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('dash.activePipeline')}</h4>
            <div className="space-y-2">
              {progressCases.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}/pipeline`)}
                  className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-fixed/60 flex items-center justify-center shrink-0">
                    <Icon name={pipelineStatusIcon[c.status]} size="sm" className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-on-surface truncate">{c.title}</p>
                    <p className="text-[12px] text-on-surface-variant">{t(pipelineStatusLabel[c.status])}</p>
                  </div>
                  <div className="shrink-0">
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <Icon name="chevron_right" className="text-outline shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* E. Recent Cases */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider">{t('dash.recentCases')}</h4>
            <button
              onClick={() => navigate('/cases')}
              className="text-[14px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t('common.viewAll')} →
            </button>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="text-start px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline">{t('dash.thCase')}</th>
                  <th className="text-start px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline">{t('dash.thStatus')}</th>
                  <th className="text-start px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline hidden md:table-cell">{t('dash.thLanguage')}</th>
                  <th className="text-start px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline hidden md:table-cell">{t('dash.thSchedule')}</th>
                  <th className="text-start px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline hidden lg:table-cell">{t('dash.thUpdated')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {recentCases.map(c => {
                  const platforms = platformsOf(c);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-surface-container/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/cases/${c.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[14px] font-medium text-on-surface truncate">{c.title}</p>
                        <p className="text-[12px] text-on-surface-variant truncate">
                          {platforms.length > 0
                            ? platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')
                            : t('dash.noOutputs')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <CaseStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-[13px] text-on-surface-variant uppercase">{c.language}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-[13px] text-on-surface-variant">{humanizeSchedule(c.schedule, i18n)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-[13px] text-on-surface-variant">{relativeDate(c.updatedAt, i18n)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Icon name="chevron_right" className="text-outline group-hover:text-primary transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </>
  );
}
