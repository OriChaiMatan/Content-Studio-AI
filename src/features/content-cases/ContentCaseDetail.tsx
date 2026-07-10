import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, LifecycleBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Card';
import { SourcesPanel } from './SourcesPanel';
import { useLiveCase } from './useLiveCase';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import { api, isQuotaApiError } from '../../lib/api';
import { useSchedulingAllowed, useActiveCaseLimitContent, buildCaseLimitInfo } from '../../hooks/useQuotaGate';
import { useArchiveConfirmModalStore } from '../../stores/archiveConfirmModalStore';
import { useActiveCaseLimitModalStore } from '../../stores/activeCaseLimitModalStore';
import type { ContentGoal, ContentStyle, ContentTarget, Language, ContentCase, ContentOutput, PipelineStep, Platform, RunSummary, Schedule, ScheduleFrequency, CaseStatus } from '../../types';

type I18n = ReturnType<typeof useT>;

// ── Enum label keys (goal/style via i18n; platform names kept literal as brands) ──
const goalKey  = (g: ContentGoal):  StringKey => `goal.${g}` as StringKey;
const styleKey = (s: ContentStyle): StringKey => `style.${s}` as StringKey;

const TARGET_LABELS: Record<ContentTarget, string> = {
  linkedin: 'LinkedIn', facebook: 'Facebook',
  newsletter: 'Newsletter', podcast: 'Podcast', images: 'Images',
};

const TARGET_ICONS: Record<ContentTarget, string> = {
  linkedin: 'work', facebook: 'groups',
  newsletter: 'email', podcast: 'mic', images: 'image',
};

const GOAL_VALUES: ContentGoal[] = ['build_authority', 'generate_leads', 'increase_sales', 'educate_audience', 'grow_community', 'personal_branding', 'other'];
const STYLE_VALUES: ContentStyle[] = ['professional', 'authoritative', 'friendly', 'personal', 'journalistic', 'provocative', 'humorous', 'other'];

// Schedule editing (inline; mirrors the create wizard's Step 3 — not extracted yet).
const FREQ_OPTIONS: { value: ScheduleFrequency; labelKey: StringKey; icon: string }[] = [
  { value: 'manual',  labelKey: 'freq.manual',  icon: 'touch_app' },
  { value: 'daily',   labelKey: 'freq.daily',   icon: 'today' },
  { value: 'weekly',  labelKey: 'freq.weekly',  icon: 'date_range' },
  { value: 'monthly', labelKey: 'freq.monthly', icon: 'calendar_month' },
];
const DOW_OPTIONS: { value: number; labelKey: StringKey }[] = [
  { value: 0, labelKey: 'dow.0' }, { value: 1, labelKey: 'dow.1' }, { value: 2, labelKey: 'dow.2' },
  { value: 3, labelKey: 'dow.3' }, { value: 4, labelKey: 'dow.4' }, { value: 5, labelKey: 'dow.5' },
  { value: 6, labelKey: 'dow.6' },
];

// ── Derived helpers (frontend-only; real output/run/source data) ──────────────

const IN_PROGRESS_STATUSES: CaseStatus[] = ['research', 'fact_check', 'generating'];

function runOutputs(c: ContentCase): ContentOutput[] {
  return c.currentRun ? c.outputs.filter(o => o.pipelineRunId === c.currentRun!.id) : c.outputs;
}
function pendingDraftsOf(c: ContentCase): number {
  return runOutputs(c).filter(o => o.status === 'draft').length;
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

// Meaningful per-step state label key (replaces abstract confidence %).
function stepLabel(step: PipelineStep, t: I18n['t']): string {
  const known = ['research', 'fact_check', 'content_creation'];
  if (known.includes(step.name)) return t(`detail.sl.${step.name}.${step.status}` as StringKey);
  return step.name.replace('_', ' ');
}

// Research integrity → High / Medium / Low (label is an i18n key).
function researchIntegrityLevel(step: PipelineStep): { labelKey: StringKey; color: string } | null {
  if (step.name !== 'research' || step.status !== 'completed') return null;
  const r = step.research;
  if (r) {
    if (r.degraded || r.status === 'degraded') return { labelKey: 'detail.integ.low', color: 'text-error' };
    if (r.status === 'mock') return { labelKey: 'detail.integ.medium', color: 'text-amber-600' };
    return { labelKey: 'detail.integ.high', color: 'text-green-700' };
  }
  if (step.confidence != null) {
    if (step.confidence >= 80) return { labelKey: 'detail.integ.high', color: 'text-green-700' };
    if (step.confidence >= 50) return { labelKey: 'detail.integ.medium', color: 'text-amber-600' };
    return { labelKey: 'detail.integ.low', color: 'text-error' };
  }
  return null;
}

const RUNNING_LABEL: Record<string, StringKey> = {
  research: 'detail.run.research', fact_check: 'detail.run.fact_check', generating: 'detail.run.generating',
};
function stepNameKey(name: string): StringKey {
  if (name === 'research') return 'detail.stepName.research';
  if (name === 'fact_check') return 'detail.stepName.fact_check';
  if (name === 'content_creation') return 'detail.stepName.content_creation';
  return 'detail.stepName.content_creation';
}

// ── Page ──────────────────────────────────────────────────

type CaseSettingsUpdate =
  Partial<Pick<ContentCase, 'contentGoal' | 'contentStyle' | 'language' | 'contentTargets'>> & {
    scheduleFrequency?:  ScheduleFrequency;
    scheduleTime?:       string | null;
    scheduleDayOfWeek?:  number | null;
    scheduleDayOfMonth?: number | null;
  };

export function ContentCaseDetail() {
  // ── ALL hooks must be called unconditionally before any early return ──────────
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const i18n = useT();
  const { t, plural, formatDateTime } = i18n;

  const caseItem       = useLiveCase(id);
  const loading        = useContentCasesStore(s => s.loading);
  const refreshCase    = useContentCasesStore(s => s.refreshCase);
  const deleteCase     = useContentCasesStore(s => s.deleteCase);
  const reactivateCase = useContentCasesStore(s => s.reactivateCase);
  const showArchiveConfirm = useArchiveConfirmModalStore(s => s.show);
  const showActiveCaseLimitModal = useActiveCaseLimitModalStore(s => s.show);
  const activeCaseLimitContent = useActiveCaseLimitContent();

  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [configOpen,      setConfigOpen]      = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);
  const [reactivating,    setReactivating]    = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  const sourcesRef = useRef<HTMLDivElement>(null);
  function scrollToSources() {
    sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Early return — not found / loading (with TopBar + a way back) ────────────
  if (!caseItem) {
    return (
      <>
        <TopBar title={t('detail.contentCase')} />
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          {loading ? (
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="text-[14px]">{t('detail.loadingCase')}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <Icon name="search_off" size="xl" className="text-outline" />
              </div>
              <div>
                <p className="text-[16px] font-medium text-on-surface">{t('detail.notFound')}</p>
                <p className="text-[13px] text-on-surface-variant mt-1">{t('detail.notFoundHint')}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}>
                <Icon name="arrow_back" size="sm" />
                {t('detail.backToCases')}
              </Button>
            </div>
          )}
        </main>
      </>
    );
  }

  const c = caseItem;
  // Archived cases are read-only — browse/search/read/copy/download/view-history
  // only. Backend already rejects mutations with 409; this drives the UI layer.
  const isArchived = c.lifecycleStatus === 'ARCHIVED';
  const currentOutputs = runOutputs(c);
  const approvedCount  = currentOutputs.filter(o => o.status === 'approved').length;
  const pending        = pendingDraftsOf(c);
  const newSources     = c.sources.filter(s => s.status === 'new').length;
  const usedSources    = c.sources.filter(s => s.status === 'used').length;
  const failedStep     = c.pipeline.find(s => s.status === 'error');
  const isRunning      = IN_PROGRESS_STATUSES.includes(c.status);

  // ── "What is happening now?" headline ──
  let statusHeadline: string;
  let statusTone: 'neutral' | 'active' | 'ready' | 'error' = 'neutral';
  if (failedStep) {
    statusHeadline = t('detail.runFailedAt', { step: t(stepNameKey(failedStep.name)) });
    statusTone = 'error';
  } else if (isRunning) {
    statusHeadline = RUNNING_LABEL[c.status] ? t(RUNNING_LABEL[c.status]) : t('detail.pipelineRunning');
    statusTone = 'active';
  } else if (pending > 0) {
    statusHeadline = plural(pending, 'detail.draftsReady.one', 'detail.draftsReady.other');
    statusTone = 'ready';
  } else if (c.status === 'completed') {
    statusHeadline = t('detail.completedReviewed');
  } else if (c.status === 'in_review') {
    statusHeadline = t('detail.allReviewed');
  } else if (c.status === 'draft') {
    statusHeadline = c.sources.length === 0 ? t('detail.draftAddSources') : t('detail.readyToGenerate');
  } else {
    statusHeadline = '';
  }

  // ── "What should I do next?" — single state-aware primary action ──
  const cta: { label: string; icon: string; run: () => void } = (() => {
    if (pending > 0)            return { label: t('common.reviewContent'), icon: 'rate_review', run: () => navigate(`/cases/${c.id}/review`) };
    if (isRunning)             return { label: t('common.viewPipeline'),  icon: 'visibility',  run: () => navigate(`/cases/${c.id}/pipeline`) };
    if (c.sources.length === 0) return { label: t('common.addSources'),    icon: 'note_add',    run: scrollToSources };
    if (newSources > 0)        return { label: c.status === 'draft' ? t('common.startPipeline') : t('common.generateNow'), icon: 'play_arrow', run: () => navigate(`/cases/${c.id}/pipeline`) };
    return { label: t('common.viewAll'), icon: 'auto_stories', run: () => navigate('/library') };
  })();

  async function handleDeleteCase() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCase(c.id);
      navigate('/cases');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('detail.deleteFailed'));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function handleArchiveCase() {
    // No onArchived continuation — stay on this same case, now rendered
    // read-only, so the user sees "everything preserved" immediately.
    showArchiveConfirm({ caseId: c.id });
  }

  async function handleReactivateCase() {
    // Proactive: known-fresh usage already says the active-case limit is
    // reached — open the conflict modal instead of sending a request we
    // already know will be rejected (mirrors the create-case flow).
    if (activeCaseLimitContent) {
      showActiveCaseLimitModal({
        mode: 'reactivate',
        activeCase: activeCaseLimitContent.activeCase,
        targetCase: buildCaseLimitInfo(c),
      });
      return;
    }
    setReactivating(true);
    setReactivateError(null);
    try {
      await reactivateCase(c.id);
    } catch (err) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge (authStore.ts) already opened the generic
      // quota modal for this rare edge case; don't ALSO show a duplicate banner.
      if (isQuotaApiError(err)) return;
      setReactivateError(err instanceof Error ? err.message : 'Failed to reactivate case.');
    } finally {
      setReactivating(false);
    }
  }

  const aboutLine = [t(goalKey(c.contentGoal)), c.targetAudience].filter(Boolean).join(' · ');

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2 bg-error-container/60 border border-error/20 rounded-xl px-3 py-1.5">
                <span className="text-[12px] text-error font-medium">{t('detail.deleteConfirm')}</span>
                <Button variant="danger" size="sm" onClick={handleDeleteCase} loading={deleting} disabled={deleting}>{t('common.confirm')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>{t('common.cancel')}</Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-lg hover:bg-error-container/30"
                title={t('detail.deleteCase')}
              >
                <Icon name="delete" size="sm" />
              </button>
            )}
            {isArchived ? (
              <Button variant="outline" size="sm" onClick={handleReactivateCase} loading={reactivating} disabled={reactivating}>
                <Icon name="unarchive" size="sm" />
                Reactivate Case
              </Button>
            ) : (
              <Button
                variant="outline" size="sm" onClick={handleArchiveCase}
                title="Archive this case without deleting its content. You can reactivate it later."
              >
                <Icon name="archive" size="sm" />
                Archive Case
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
              <Icon name="schema" size="sm" />
              {t('detail.pipeline')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6 max-w-6xl mx-auto w-full">
        {deleteError && (
          <div className="flex items-center gap-3 bg-error-container/60 border border-error/20 rounded-xl px-4 py-3">
            <Icon name="error" className="text-error shrink-0" size="sm" />
            <p className="text-[13px] text-on-error-container">{deleteError}</p>
          </div>
        )}
        {reactivateError && (
          <div className="flex items-center gap-3 bg-error-container/60 border border-error/20 rounded-xl px-4 py-3">
            <Icon name="error" className="text-error shrink-0" size="sm" />
            <p className="text-[13px] text-on-error-container">{reactivateError}</p>
          </div>
        )}
        {isArchived && (
          <div className="flex items-start gap-3 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3">
            <Icon name="archive" className="text-outline shrink-0 mt-0.5" size="sm" />
            <p className="text-[13px] text-on-surface-variant">
              This case is archived. Existing content remains available, but new content generation is disabled.
            </p>
          </div>
        )}

        {/* ── A. Smart header: about · status · next action ─────────── */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <CaseStatusBadge status={c.status} />
                <LifecycleBadge status={c.lifecycleStatus} alwaysShow />
                <span className="text-[12px] text-on-surface-variant uppercase font-bold tracking-wider">{c.language}</span>
                <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                  <Icon name="schedule" size="sm" className="text-outline" />
                  {humanizeSchedule(c.schedule, i18n)}
                </span>
              </div>
              <h2 className="text-[22px] md:text-[28px] font-serif text-on-surface mb-1 line-clamp-2 md:truncate">{c.title}</h2>
              {aboutLine && <p className="text-[14px] text-on-surface-variant">{aboutLine}</p>}

              {/* What's happening now */}
              {statusHeadline && (
                <div className="flex items-center gap-2 mt-3">
                  <Icon
                    name={statusTone === 'error' ? 'error' : statusTone === 'active' ? 'autorenew' : statusTone === 'ready' ? 'rate_review' : 'check_circle'}
                    size="sm"
                    className={statusTone === 'error' ? 'text-error' : statusTone === 'active' ? 'text-tertiary' : statusTone === 'ready' ? 'text-green-600' : 'text-outline'}
                  />
                  <span className={`text-[14px] font-medium ${statusTone === 'error' ? 'text-error' : 'text-on-surface'}`}>{statusHeadline}</span>
                </div>
              )}
            </div>

            {/* Single primary next action — full width on mobile, inline on desktop.
                Archived cases have no "next action" — they're done. */}
            {!isArchived && (
              <div className="shrink-0 w-full md:w-auto">
                <Button onClick={cta.run} className="w-full md:w-auto">
                  <Icon name={cta.icon} size="sm" />
                  {cta.label}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── B. Status strip: pipeline state · approval · sources · last run ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            icon="schema"
            label={t('detail.pipeline')}
            value={failedStep ? t('detail.pv.failed') : isRunning ? t('detail.pv.running') : c.status === 'draft' ? t('detail.pv.notStarted') : t('detail.pv.complete')}
            tone={failedStep ? 'error' : isRunning ? 'active' : 'neutral'}
          />
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30">
            <p className="text-[11px] uppercase font-bold text-outline tracking-wider mb-1">{t('detail.approval')}</p>
            {currentOutputs.length > 0 ? (
              <>
                <p className="text-[15px] font-medium text-on-surface">
                  {t('cases.approvedCount', { approved: approvedCount, total: currentOutputs.length })}
                  {pending > 0 && <span className="text-on-surface-variant font-normal"> {t('detail.pendingCount', { count: pending })}</span>}
                </p>
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden mt-2">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${(approvedCount / currentOutputs.length) * 100}%` }} />
                </div>
              </>
            ) : (
              <p className="text-[14px] text-on-surface-variant">{t('detail.noOutputs')}</p>
            )}
          </div>
          <StatTile
            icon="article"
            label={t('detail.sources')}
            value={c.sources.length === 0 ? t('detail.noneYet') : usedSources > 0 ? t('detail.sourcesNewUsed', { count: newSources, used: usedSources }) : t('detail.sourcesNew', { count: newSources })}
            tone={newSources > 0 ? 'active' : 'neutral'}
          />
          <StatTile
            icon="history"
            label={t('detail.lastRun')}
            value={c.currentRun?.completedAt ? formatDateTime(c.currentRun.completedAt) : c.currentRun?.startedAt ? t('detail.inProgress') : t('detail.never')}
            tone="neutral"
          />
        </div>

        {/* ── C. Configuration (compact, secondary, collapsible) ───────── */}
        <section>
          <button
            type="button"
            onClick={() => setConfigOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 hover:bg-surface-container transition-colors"
          >
            <Icon name="tune" size="sm" className="text-outline" />
            <span className="text-[13px] font-medium text-on-surface">{t('detail.configuration')}</span>
            <span className="text-[12px] text-on-surface-variant truncate hidden sm:block">
              {t(goalKey(c.contentGoal))} · {t(styleKey(c.contentStyle))} · {t(c.language === 'en' ? 'lang.en' : 'lang.he')} · {humanizeSchedule(c.schedule, i18n)}
            </span>
            <Icon name={configOpen ? 'expand_less' : 'expand_more'} size="sm" className="text-outline ml-auto" />
          </button>

          {configOpen && (
            <div className="mt-3 space-y-4">
              <CaseSettingsCard
                c={c}
                editing={editingSettings}
                saving={savingSettings}
                onEdit={() => setEditingSettings(true)}
                onCancel={() => setEditingSettings(false)}
                onSave={async (updates) => {
                  setSavingSettings(true);
                  try {
                    await api.patch<ContentCase>(`/cases/${c.id}`, updates);
                    await refreshCase(c.id);
                    setEditingSettings(false);
                  } catch { /* silently fail */ }
                  finally { setSavingSettings(false); }
                }}
              />

              {(c.writingStyle || c.goals || c.aiInstructions) && (
                <Card accent className="p-5">
                  <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Icon name="edit_note" className="text-outline" size="sm" />
                    {t('detail.writingStyleGoals')}
                  </h4>
                  <div className="space-y-3">
                    {c.writingStyle && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.wsStyle')}</p><p className="text-[14px] text-on-surface mt-1" dir="auto" style={{ unicodeBidi: 'plaintext' }}>{c.writingStyle}</p></div>}
                    {c.goals && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.wsGoals')}</p><p className="text-[14px] text-on-surface mt-1" dir="auto" style={{ unicodeBidi: 'plaintext' }}>{c.goals}</p></div>}
                    {c.aiInstructions && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.wsAiInstructions')}</p><p className="text-[14px] text-on-surface mt-1 bg-surface-container-low rounded-lg p-3 italic" dir="auto" style={{ unicodeBidi: 'plaintext' }}>{c.aiInstructions}</p></div>}
                  </div>
                </Card>
              )}
            </div>
          )}
        </section>

        {/* ── D. Outputs (rich) ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <Icon name="auto_awesome" className="text-outline" size="sm" />
              {t('detail.outputs')}
            </h4>
            {pending > 0 && (
              <Button size="sm" onClick={() => navigate(`/cases/${c.id}/review`)}>
                <Icon name="rate_review" size="sm" />
                {t('common.reviewContent')}
              </Button>
            )}
          </div>

          {currentOutputs.length === 0 ? (
            <Card className="p-6">
              <div className="flex flex-col items-center py-4 text-center gap-2">
                <Icon name="pending" size="xl" className="text-outline" />
                <p className="text-[13px] text-on-surface-variant">
                  {c.status === 'draft' ? t('detail.emptyDraft') : isRunning ? t('detail.emptyRunning') : t('detail.emptyNoRun')}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentOutputs.map(output => (
                <Card key={output.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <PlatformBadge platform={output.platform} />
                    <OutputStatusBadge status={output.status} />
                  </div>
                  <p className="text-[14px] font-medium text-on-surface truncate" dir="auto">{output.title}</p>
                  <p className="text-[12px] text-on-surface-variant mt-1 line-clamp-2 whitespace-pre-wrap text-start" dir="auto" style={{ unicodeBidi: 'plaintext' }}>{output.body}</p>
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-outline-variant/20 text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1 ml-auto">
                      <Icon name="schedule" size="sm" className="text-outline" />
                      {formatDateTime(output.generatedAt)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Pipeline progress (meaningful states) ───────────────────── */}
        <section>
          <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="conversion_path" className="text-outline" size="sm" />
            {t('detail.pipelineProgress')}
          </h4>
          <Card className="p-5">
            <div className="space-y-3">
              {c.pipeline.map(step => {
                const integrity = researchIntegrityLevel(step);
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={[
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                      step.status === 'completed' ? 'bg-primary text-on-primary' :
                      step.status === 'running'   ? 'bg-secondary-container text-on-secondary-container' :
                      step.status === 'error'     ? 'bg-error-container text-error' :
                      'bg-surface-container text-outline',
                    ].join(' ')}>
                      {step.status === 'completed' ? <Icon name="check" size="sm" />
                        : step.status === 'running' ? <span className="material-symbols-outlined text-xs animate-spin">refresh</span>
                        : step.status === 'error' ? <Icon name="close" size="sm" />
                        : <Icon name="circle" size="sm" />}
                    </div>
                    <p className={`text-[13px] ${step.status === 'idle' ? 'text-outline' : step.status === 'error' ? 'text-error font-medium' : 'text-on-surface'}`}>
                      {stepLabel(step, t)}
                    </p>
                    {integrity && (
                      <span className={`ms-auto text-[11px] font-bold ${integrity.color}`}>
                        {t('detail.researchIntegrity', { level: t(integrity.labelKey) })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="secondary" size="sm" fullWidth className="mt-4" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
              {!isArchived && c.status === 'draft' ? t('common.startPipeline') : t('common.viewPipeline')}
            </Button>
          </Card>
        </section>

        {/* ── E. Sources workspace (internally scrollable list) ──────────── */}
        <section ref={sourcesRef}>
          <SourcesPanel caseId={c.id} />
        </section>

        {/* ── F. Run History (internally scrollable; below Sources) ─────── */}
        <RunHistorySection caseId={c.id} runs={c.runHistory ?? []} outputs={c.outputs} onNavigate={navigate} />

      </main>
    </>
  );
}

// ── Status tile ───────────────────────────────────────────
function StatTile({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: 'neutral' | 'active' | 'error' }) {
  const valueColor = tone === 'error' ? 'text-error' : tone === 'active' ? 'text-tertiary' : 'text-on-surface';
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30">
      <p className="text-[11px] uppercase font-bold text-outline tracking-wider mb-1 flex items-center gap-1">
        <Icon name={icon} size="sm" className="text-outline" />
        {label}
      </p>
      <p className={`text-[15px] font-medium ${valueColor}`}>{value}</p>
    </div>
  );
}

// ── Run History (compact cards; internally scrollable) ────────────────────────

const RUN_STATUS_STYLE: Record<string, { labelKey: StringKey; cls: string }> = {
  completed: { labelKey: 'detail.rs.completed', cls: 'bg-green-100 text-green-700' },
  running:   { labelKey: 'detail.rs.running',   cls: 'bg-secondary-container text-on-secondary-container' },
  failed:    { labelKey: 'detail.rs.failed',    cls: 'bg-red-100 text-red-700' },
  pending:   { labelKey: 'detail.rs.pending',   cls: 'bg-surface-container text-on-surface-variant' },
};

function runIntegrityChip(r: RunSummary): { labelKey: StringKey; cls: string } | null {
  if (!r.research) return null;
  switch (r.research.status) {
    case 'success':  return { labelKey: 'detail.researchChip.high',   cls: 'text-green-700' };
    case 'mock':     return { labelKey: 'detail.researchChip.medium', cls: 'text-amber-600' };
    case 'degraded': return { labelKey: 'detail.researchChip.low',    cls: 'text-error' };
    default:         return null;
  }
}

function RunHistoryCard({ run, outputs, caseId, onNavigate }: {
  run: RunSummary; outputs: ContentOutput[]; caseId: string; onNavigate: (to: string) => void;
}) {
  const { t, plural, locale } = useT();
  const approved = outputs.filter(o => o.status === 'approved').length;
  const pending  = outputs.filter(o => o.status === 'draft').length;
  const rejected = outputs.filter(o => o.status === 'rejected').length;
  const platforms = [...new Set(outputs.map(o => o.platform))] as Platform[];
  const st = RUN_STATUS_STYLE[run.status] ?? RUN_STATUS_STYLE.pending;
  const integ = runIntegrityChip(run);
  const when = new Date(run.startedAt);
  const showPipeline = run.status === 'running' || run.status === 'pending' || run.status === 'failed';

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="schedule" size="sm" className="text-outline shrink-0" />
          <span className="text-[13px] font-medium text-on-surface truncate">
            {when.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}, {when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {run.triggeredBy === 'schedule' && (
            <span className="text-[10px] uppercase tracking-wide text-outline shrink-0">{t('detail.scheduled')}</span>
          )}
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{t(st.labelKey)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-on-surface-variant mb-2">
        <span className="flex items-center gap-1"><Icon name="article" size="sm" className="text-outline" />{plural(run.sourceCount, 'count.sources.one', 'count.sources.other')}</span>
        <span className="flex items-center gap-1"><Icon name="auto_awesome" size="sm" className="text-outline" />{plural(outputs.length, 'detail.outputs.one', 'detail.outputs.other')}</span>
        {approved > 0 && <span className="text-green-700 font-medium">{t('detail.approvedN', { count: approved })}</span>}
        {pending > 0 && <span className="text-amber-600 font-medium">{t('detail.pendingN', { count: pending })}</span>}
        {rejected > 0 && <span className="text-error font-medium">{t('detail.rejectedN', { count: rejected })}</span>}
        {integ && <span className={`font-medium ${integ.cls}`}>{t(integ.labelKey)}</span>}
      </div>

      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
        </div>
      )}

      {run.status === 'failed' && run.errorMessage && (
        <p className="text-[11px] text-error mb-2 line-clamp-2">{run.errorMessage}</p>
      )}

      <div className="flex items-center gap-2">
        {outputs.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onNavigate(`/cases/${caseId}/review?runId=${run.id}`)}>
            <Icon name="rate_review" size="sm" />
            {t('detail.viewReview')}
          </Button>
        )}
        {showPipeline && (
          <Button size="sm" variant="ghost" onClick={() => onNavigate(`/cases/${caseId}/pipeline`)}>
            <Icon name="schema" size="sm" />
            {t('common.viewPipeline')}
          </Button>
        )}
      </div>
    </div>
  );
}

function RunHistorySection({ caseId, runs, outputs, onNavigate }: {
  caseId: string; runs: RunSummary[]; outputs: ContentOutput[]; onNavigate: (to: string) => void;
}) {
  const { t, plural } = useT();
  // Group the case's already-fetched outputs by run (no extra fetch, no bodies rendered).
  const byRun = new Map<string, ContentOutput[]>();
  for (const o of outputs) {
    if (!o.pipelineRunId) continue;
    const arr = byRun.get(o.pipelineRunId) ?? [];
    arr.push(o);
    byRun.set(o.pipelineRunId, arr);
  }

  return (
    <section>
      <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="history" className="text-outline" size="sm" />
        {t('detail.runHistory')}
        {runs.length > 0 && (
          <span className="text-[12px] font-normal text-outline normal-case tracking-normal">{plural(runs.length, 'detail.runsCount.one', 'detail.runsCount.other')}</span>
        )}
      </h4>

      {runs.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center gap-1.5 py-2">
            <Icon name="history" size="xl" className="text-outline" />
            <p className="text-[13px] text-on-surface-variant">{t('detail.noRuns')}</p>
            <p className="text-[12px] text-outline">{t('detail.noRunsHint')}</p>
          </div>
        </Card>
      ) : (
        <div className="max-h-[360px] md:max-h-[440px] overflow-y-auto space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 p-3">
          {runs.map(run => (
            <RunHistoryCard key={run.id} run={run} outputs={byRun.get(run.id) ?? []} caseId={caseId} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Case Settings Card ────────────────────────────────────
// Shows new simplified wizard fields with inline editing.

interface CaseSettingsCardProps {
  c: ContentCase;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: CaseSettingsUpdate) => Promise<void>;
}

function CaseSettingsCard({ c, editing, saving, onEdit, onCancel, onSave }: CaseSettingsCardProps) {
  const i18n = useT();
  const { t } = i18n;
  const [goal,    setGoal]    = useState<ContentGoal>(c.contentGoal);
  const [style,   setStyle]   = useState<ContentStyle>(c.contentStyle);
  const [lang,    setLang]    = useState<Language>(c.language);
  const [targets, setTargets] = useState<ContentTarget[]>(c.contentTargets);
  const [freq, setFreq] = useState<ScheduleFrequency>(c.schedule.frequency);
  const [time, setTime] = useState<string>(c.schedule.time ?? '09:00');
  const [dow,  setDow]  = useState<number>(c.schedule.dayOfWeek ?? 1);
  const [dom,  setDom]  = useState<number>(c.schedule.dayOfMonth ?? 1);
  // Free plan blocks only 'daily' scheduling — mirrors the backend's
  // assertSchedulingAllowed for a proactive UI hint (backend stays authoritative).
  const dailyAllowed = useSchedulingAllowed('daily');
  const lockedFrequency = (v: ScheduleFrequency) => v === 'daily' && !dailyAllowed;
  // Legacy data guard: a case saved with Daily before this rule (or via a since-
  // downgraded plan) can still have schedule.frequency === 'daily' on load. Keep
  // showing that current value, but block Save until the user actively picks a
  // frequency their plan allows — never silently keep or silently rewrite it.
  const staleDailyBlock = freq === 'daily' && !dailyAllowed;

  function toggleTarget(target: ContentTarget) {
    setTargets(prev => prev.includes(target) ? prev.filter(x => x !== target) : [...prev, target]);
  }

  const allTargets: { value: ContentTarget; icon: string }[] = [
    { value: 'linkedin', icon: 'work' }, { value: 'facebook', icon: 'groups' },
    { value: 'newsletter', icon: 'email' },
  ];

  function handleEdit() {
    setGoal(c.contentGoal); setStyle(c.contentStyle);
    setLang(c.language);    setTargets(c.contentTargets);
    setFreq(c.schedule.frequency);
    setTime(c.schedule.time ?? '09:00');
    setDow(c.schedule.dayOfWeek ?? 1);
    setDom(c.schedule.dayOfMonth ?? 1);
    onEdit();
  }

  return (
    <Card accent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
          <Icon name="tune" className="text-outline" size="sm" />
          {t('detail.caseSettings')}
        </h4>
        {!editing && c.lifecycleStatus === 'ACTIVE' && (
          <button onClick={handleEdit} className="text-[12px] text-primary font-medium flex items-center gap-1 hover:underline">
            <Icon name="edit" size="sm" />{t('detail.edit')}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.fGoal')}</p>
              <p className="text-[14px] text-on-surface mt-1">
                {t(goalKey(c.contentGoal))}{c.goalCustom ? ` — ${c.goalCustom}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.fStyle')}</p>
              <p className="text-[14px] text-on-surface mt-1">
                {t(styleKey(c.contentStyle))}{c.styleCustom ? ` — ${c.styleCustom}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.fLanguage')}</p>
              <p className="text-[14px] text-on-surface mt-1">{t(c.language === 'en' ? 'lang.en' : 'lang.he')}</p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">{t('detail.fSchedule')}</p>
              <p className="text-[14px] text-on-surface mt-1">{humanizeSchedule(c.schedule, i18n)}</p>
              {c.schedule.frequency === 'daily' && !dailyAllowed && (
                <p className="flex items-center gap-1 text-[11px] text-error mt-1">
                  <Icon name="warning" size="sm" />
                  Daily scheduling is unavailable on the Free plan — edit to update.
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-outline uppercase font-bold tracking-wider mb-1.5">{t('detail.fContentTargets')}</p>
            <div className="flex flex-wrap gap-1.5">
              {c.contentTargets.length > 0 ? c.contentTargets.map(target => (
                <span key={target} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[12px] font-medium">
                  <Icon name={TARGET_ICONS[target]} size="sm" />
                  {TARGET_LABELS[target]}
                </span>
              )) : (
                <span className="text-[13px] text-outline">{t('detail.allPlatformsLegacy')}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Goal select */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">{t('detail.fGoal')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {GOAL_VALUES.map(v => (
                <button key={v} type="button" onClick={() => setGoal(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium text-left transition-all ${goal===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {t(goalKey(v))}
                </button>
              ))}
            </div>
          </div>

          {/* Style select */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">{t('detail.fContentStyle')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_VALUES.map(v => (
                <button key={v} type="button" onClick={() => setStyle(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium text-left transition-all ${style===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {t(styleKey(v))}
                </button>
              ))}
            </div>
          </div>

          {/* Language toggle */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">{t('detail.fLanguage')}</p>
            <div className="flex gap-2">
              {(['en', 'he'] as Language[]).map(v => (
                <button key={v} type="button" onClick={() => setLang(v)}
                  className={`px-4 py-2 rounded-lg border text-[12px] font-medium transition-all ${lang===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {t(v === 'en' ? 'lang.en' : 'lang.he')}
                </button>
              ))}
            </div>
          </div>

          {/* Content Targets */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">{t('detail.fContentTargets')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {allTargets.map(({ value: target, icon }) => {
                const sel = targets.includes(target);
                return (
                  <button key={target} type="button" onClick={() => toggleTarget(target)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${sel ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                    <Icon name={icon} size="sm" />
                    {TARGET_LABELS[target]}
                  </button>
                );
              })}
            </div>
            {targets.length === 0 && <p className="text-[11px] text-error mt-1">{t('detail.selectAtLeastOne')}</p>}
          </div>

          {/* Generate Schedule */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">{t('wiz.freqLabel')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FREQ_OPTIONS.map(opt => {
                const locked = lockedFrequency(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={locked}
                    onClick={() => setFreq(opt.value)}
                    title={locked ? 'Daily scheduling is available in LumAI Pro.' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                      locked ? 'opacity-50 cursor-not-allowed border-outline-variant text-on-surface-variant' :
                      freq === opt.value ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <Icon name={opt.icon} size="sm" />
                    {t(opt.labelKey)}
                    {locked && <Icon name="lock" size="sm" className="text-outline ms-auto" />}
                  </button>
                );
              })}
            </div>
            {staleDailyBlock && (
              <p className="flex items-center gap-1 text-[11px] text-error mt-1.5">
                <Icon name="warning" size="sm" />
                Daily scheduling is unavailable on the Free plan. Choose Manual, Weekly, or Monthly to save.
              </p>
            )}

            {freq !== 'manual' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {freq === 'weekly' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">{t('wiz.dayOfWeek')}</label>
                    <select value={dow} onChange={e => setDow(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface">
                      {DOW_OPTIONS.map(d => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
                    </select>
                  </div>
                )}
                {freq === 'monthly' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">{t('wiz.dayOfMonth')}</label>
                    <select value={dom} onChange={e => setDom(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-on-surface-variant">{t('wiz.time')}</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface" />
                </div>
              </div>
            )}
            {freq === 'manual' && (
              <p className="text-[11px] text-on-surface-variant mt-1.5">{t('detail.manualNote')}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => onSave({
                contentGoal: goal, contentStyle: style, language: lang, contentTargets: targets,
                scheduleFrequency:  freq,
                scheduleTime:       freq === 'manual' ? null : time,
                scheduleDayOfWeek:  freq === 'weekly'  ? dow : null,
                scheduleDayOfMonth: freq === 'monthly' ? dom : null,
              })}
              loading={saving} disabled={saving || targets.length === 0 || staleDailyBlock}>
              <Icon name="save" size="sm" />
              {saving ? t('common.saving') : t('detail.saveSettings')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
