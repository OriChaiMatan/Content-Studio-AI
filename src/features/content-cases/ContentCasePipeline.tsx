import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLiveCase } from './useLiveCase';
import { useMetricLimitContent } from '../../hooks/useQuotaGate';
import { useQuotaModalStore } from '../../stores/quotaModalStore';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import { ApiError, isQuotaApiError } from '../../lib/api';
import type { PipelineStep } from '../../types';

// ── Step metadata ─────────────────────────────────────────

const stepMeta: Record<PipelineStep['name'], { icon: string; titleKey: StringKey; descKey: StringKey }> = {
  research: {
    icon: 'search',
    titleKey: 'pipeline.step.research',
    descKey: 'pipeline.step.research.desc',
  },
  fact_check: {
    icon: 'fact_check',
    titleKey: 'pipeline.step.fact_check',
    descKey: 'pipeline.step.fact_check.desc',
  },
  content_creation: {
    icon: 'auto_awesome',
    titleKey: 'pipeline.step.content_creation',
    descKey: 'pipeline.step.content_creation.desc',
  },
};

// ── Step card ─────────────────────────────────────────────

function StepCard({ step }: { step: PipelineStep }) {
  const { t, plural, locale } = useT();
  const meta = stepMeta[step.name];
  // Phase 10D.0 — a "completed" research step that degraded must look DEGRADED, not green.
  const degradedResearch = step.research?.status === 'degraded';
  const statusColor = degradedResearch ? 'border-amber-300 bg-amber-50/60' : {
    idle:      'border-outline-variant/30 bg-surface-container-lowest',
    running:   'border-primary/30 bg-primary-fixed/20',
    completed: 'border-green-300 bg-green-50/50',
    error:     'border-error/30 bg-error-container/20',
  }[step.status];
  const iconBg = degradedResearch ? 'bg-amber-500 text-white' : {
    idle:      'bg-surface-container text-outline',
    running:   'bg-primary text-on-primary',
    completed: 'bg-green-500 text-white',
    error:     'bg-error text-on-error',
  }[step.status];

  return (
    <div className={`rounded-xl border p-6 transition-all ${statusColor} ${step.status === 'running' ? 'shadow-md' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {step.status === 'running'   ? <span className="material-symbols-outlined animate-spin">{meta.icon}</span> :
           degradedResearch            ? <Icon name="warning" /> :
           step.status === 'completed' ? <Icon name="check" /> :
           step.status === 'error'     ? <Icon name="error_outline" /> :
           <Icon name={meta.icon} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[18px] font-serif font-medium text-on-surface">{t(meta.titleKey)}</h3>
            <StatusChip status={step.status} degraded={degradedResearch} />
          </div>
          <p className="text-[14px] text-on-surface-variant">{t(meta.descKey)}</p>
          {step.status === 'running' && (
            <div className="mt-4">
              <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-[12px] text-on-surface-variant mt-2">{t('pipeline.processing')}</p>
            </div>
          )}

          {step.status === 'error' && step.summary && (
            <div className="mt-4 bg-error-container/40 border border-error/20 rounded-lg p-4">
              <p className="text-[12px] font-medium text-error mb-1">{t('pipeline.stepFailed')}</p>
              <p className="text-[12px] text-on-surface">{step.summary}</p>
            </div>
          )}
          {step.status === 'completed' && step.summary && (
            <div className="mt-4 bg-surface-container-low rounded-lg p-4 space-y-2">
              <p className="text-[13px] text-on-surface">{step.summary}</p>
              {step.confidence !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${step.confidence}%` }} />
                  </div>
                  <span className="text-[12px] font-bold text-primary shrink-0">{t('pipeline.confidence', { value: step.confidence })}</span>
                </div>
              )}
            </div>
          )}
          {/* Phase 10D.0 — research integrity: did the thesis competition actually run? */}
          {step.research && step.status !== 'running' && step.status !== 'idle' && (
            step.research.status === 'degraded' ? (
              <div className="mt-3 bg-amber-100/70 border border-amber-300 rounded-lg p-3">
                <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1">
                  <Icon name="warning" size="sm" /> {t('pipeline.thesisUnavailable')}
                </p>
                <p className="text-[12px] text-amber-900 mt-1">
                  {t('pipeline.thesisFellBack', { version: step.research.generatorVersion })}
                </p>
              </div>
            ) : step.research.status === 'success' ? (
              <p className="text-[12px] text-green-700 mt-2 flex items-center gap-1">
                <Icon name="check" size="sm" /> {plural(step.research.candidateCount, 'pipeline.thesisExecutedOne', 'pipeline.thesisExecutedOther')}
              </p>
            ) : (
              <p className="text-[12px] text-on-surface-variant mt-2">
                {t('pipeline.thesisDisabled')}
              </p>
            )
          )}
          {step.completedAt && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              {t('pipeline.completedAt', { time: new Date(step.completedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, degraded }: { status: PipelineStep['status']; degraded?: boolean }) {
  const { t } = useT();
  if (degraded) {
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">{t('pipeline.status.degraded')}</span>;
  }
  const cfg = {
    idle:      { labelKey: 'pipeline.status.waiting'   as StringKey, bg: 'bg-surface-container text-on-surface-variant' },
    running:   { labelKey: 'pipeline.status.running'   as StringKey, bg: 'bg-primary-fixed/60 text-primary' },
    completed: { labelKey: 'pipeline.status.completed' as StringKey, bg: 'bg-green-100 text-green-700' },
    error:     { labelKey: 'pipeline.status.error'     as StringKey, bg: 'bg-error-container text-on-error-container' },
  }[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg}`}>{t(cfg.labelKey)}</span>;
}

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div className="flex justify-center my-1">
      <div className={`w-0.5 h-6 rounded-full ${done ? 'bg-green-400' : 'bg-outline-variant'}`} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function ContentCasePipeline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, plural } = useT();
  const loading             = useContentCasesStore(s => s.loading);
  const runPipeline         = useContentCasesStore(s => s.runPipeline);
  // Live, auto-refreshing case (shared with the case detail page).
  const view                = useLiveCase(id);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting]     = useState(false);
  // Phase 14B fix — bootstrap-polling flag. /pipeline/run returns 202 before the
  // detached startRun has committed, so the first refresh can see old state and
  // inProgress would never flip → polling never starts. We set this on a successful
  // launch and poll regardless of inProgress until the run becomes visible (handoff)
  // or a safety timeout fires.
  const [runnerActive, setRunnerActive] = useState(false);
  // Output language chosen per run (Phase 8.6). null = use the case default.
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'he' | null>(null);
  const pipelineRunLimitContent = useMetricLimitContent('PIPELINE_RUN');
  const showQuotaModal = useQuotaModalStore(s => s.show);

  const runningStep   = view?.pipeline.find(s => s.status === 'running');
  const allDone       = view?.pipeline.every(s => s.status === 'completed');
  const hasErrorStep  = view?.pipeline.some(s => s.status === 'error') ?? false;
  const newSources    = view?.sources.filter(s => s.status === 'new') ?? [];
  const usedSources   = view?.sources.filter(s => s.status === 'used') ?? [];
  const hasNewSources = newSources.length > 0;

  // Phase 14B — the SERVER-SIDE runner advances the pipeline; the browser only polls
  // (via useLiveCase). The UI no longer calls advancePipelineStep.
  const inProgress = !!runningStep || ['research', 'fact_check', 'generating'].includes(view?.status ?? '');

  // Handoff: once a locally-launched run is visibly in progress, clear the bootstrap
  // flag (it only drives the "Starting…" button UX, not polling anymore).
  useEffect(() => {
    if (runnerActive && inProgress) setRunnerActive(false);
  }, [runnerActive, inProgress]);

  // Safety: if a launched run never becomes visible (e.g. startRun raced/failed),
  // stop bootstrap polling after 20s so we don't poll forever.
  useEffect(() => {
    if (!runnerActive) return;
    const t = setTimeout(() => setRunnerActive(false), 20000);
    return () => clearTimeout(t);
  }, [runnerActive]);

  // True while a launch is in flight or bootstrapping (before the run is visibly
  // running). Keeps the Generate buttons in a loading/disabled state so the UI never
  // looks static between the click and the first 'research running' refresh.
  const isLaunching = starting || (runnerActive && !inProgress);

  if (!view) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-on-surface-variant">
        {loading
          ? <><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">{t('pipeline.loading')}</span></>
          : <p className="text-[14px]">{t('pipeline.notFound')}</p>}
      </div>
    );
  }

  const c = view;
  // Archived cases are read-only — never run/regenerate anything (see the
  // Content Case Lifecycle plan). Backend already rejects with 409; this just
  // keeps the UI from offering a doomed action in the first place.
  const isArchived = c.lifecycleStatus === 'ARCHIVED';

  // Default to the case language for backward compatibility, else English.
  const effectiveLang: 'en' | 'he' = outputLanguage ?? (c.language === 'he' ? 'he' : 'en');

  async function handleStart() {
    if (!id || starting || runnerActive || isArchived) return;
    // Proactive: known-fresh usage says the limit is reached — open the modal
    // instead of sending a request we already know will be rejected.
    if (pipelineRunLimitContent) { showQuotaModal(pipelineRunLimitContent); return; }
    setStartError(null);
    setStarting(true);
    try {
      await runPipeline(id, effectiveLang);
      // 202 accepted — begin bootstrap polling immediately, even though the detached
      // runner may not have flipped the case to 'research' in the DB yet.
      setRunnerActive(true);
    } catch (err) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge already opened the same modal; skip the banner.
      if (isQuotaApiError(err)) return;
      if (err instanceof ApiError) {
        setStartError(err.message);
      }
    } finally {
      setStarting(false);
    }
  }

  // Source selection summary (shown if a run exists)
  const run = c.currentRun;

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex items-center gap-3">
            <CaseStatusBadge status={c.status} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>
              <Icon name="arrow_back" size="sm" />
              {t('pipeline.backToCase')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h3 className="text-[22px] font-serif text-on-surface mb-1">{t('pipeline.heading')}</h3>
            <p className="text-[14px] text-on-surface-variant">
              {t('pipeline.subtitle')}
            </p>
          </div>

          {/* Source selection info */}
          {run && inProgress ? (
            // ACTIVE run only: show the run's frozen snapshot (what this run is
            // processing). When no run is active (idle/completed), fall through to the
            // live source-status counts below so the banner reflects what the NEXT run
            // will select (sources added since the last run are included).
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-primary-fixed/20 border-primary/20">
              <Icon name="article" className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-on-surface">
                  {plural(run.primarySourceIds.length, 'pipeline.primarySelectedOne', 'pipeline.primarySelectedOther')}
                  {run.contextSourceIds.length > 0 && (
                    <span className="text-on-surface-variant font-normal">
                      {plural(run.contextSourceIds.length, 'pipeline.contextOne', 'pipeline.contextOther')}
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  {t('pipeline.primaryNote')}
                </p>
              </div>
            </div>
          ) : !hasNewSources && c.sources.length > 0 ? (
            // No new sources, but has used sources
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-surface-container-low border-outline-variant/30">
              <Icon name="warning" className="text-outline shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface-variant">{t('pipeline.noNewSources')}</p>
                <p className="text-[12px] text-outline mt-0.5">
                  {plural(c.sources.length, 'pipeline.allUsedPrefixOne', 'pipeline.allUsedPrefixOther')}
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    {t('pipeline.addNewSources')}
                  </button>
                  {t('pipeline.allUsedSuffix')}
                </p>
              </div>
            </div>
          ) : c.sources.length === 0 ? (
            // No sources at all
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-surface-container-low border-outline-variant/30">
              <Icon name="article" className="text-outline shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface-variant">{t('pipeline.noSourcesYet')}</p>
                <p className="text-[12px] text-outline mt-0.5">
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    {t('pipeline.addSources')}
                  </button>
                  {t('pipeline.beforeRunningSuffix')}
                </p>
              </div>
            </div>
          ) : (
            // Has new sources, not yet started
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-primary-fixed/20 border-primary/20">
              <Icon name="article" className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface">
                  {plural(newSources.length, 'pipeline.sourcesReadyOne', 'pipeline.sourcesReadyOther')}
                  {usedSources.length > 0 && <span className="text-on-surface-variant font-normal">{plural(usedSources.length, 'pipeline.willUseContextOne', 'pipeline.willUseContextOther')}</span>}
                </p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  {t('pipeline.primaryNoteShort')}
                </p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {startError && (
            <div className="flex items-center gap-3 rounded-xl p-4 mb-6 border bg-error-container/50 border-error/20">
              <Icon name="error" className="text-error shrink-0" />
              <p className="text-[13px] text-on-error-container">{startError}</p>
            </div>
          )}

          {/* Pipeline steps */}
          <div>
            {c.pipeline.map((step, i) => (
              <div key={step.id}>
                <StepCard step={step} />
                {i < c.pipeline.length - 1 && <ConnectorLine done={step.status === 'completed'} />}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-8 flex flex-col gap-4">
            {/* Output language selector — applies to the next run. Available
                whenever a run can be triggered, independent of the schedule. */}
            {!runningStep && hasNewSources && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[13px] font-medium text-on-surface-variant">{t('pipeline.outputLanguage')}</span>
                <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
                  {([
                    { value: 'en' as const, label: 'English' },
                    { value: 'he' as const, label: 'Hebrew (עברית)' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOutputLanguage(opt.value)}
                      className={[
                        'px-3 py-1.5 text-[13px] font-medium transition-colors',
                        effectiveLang === opt.value
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Initial start — only for brand-new draft cases */}
            {c.status === 'draft' && !allDone && !runningStep && (
              <Button
                fullWidth
                onClick={handleStart}
                disabled={!hasNewSources || isLaunching || isArchived}
                loading={isLaunching}
              >
                <Icon name="play_arrow" size="sm" />
                {isLaunching ? t('pipeline.starting') : t('pipeline.start')}
              </Button>
            )}

            {/* Running message */}
            {runningStep && !allDone && (
              <div className="text-center text-[14px] text-on-surface-variant">
                {t('pipeline.runningMessage')}
              </div>
            )}

            {/* Completion banner + Review button */}
            {allDone && (
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl p-4">
                  <Icon name="check_circle" className="text-green-600" />
                  <div>
                    <p className="text-[14px] font-medium text-green-800">{t('pipeline.allComplete')}</p>
                    <p className="text-[12px] text-green-700">
                      {(() => {
                        const currentRunId = c.currentRun?.id;
                        const count = currentRunId
                          ? c.outputs.filter(o => o.pipelineRunId === currentRunId).length
                          : c.outputs.length;
                        return plural(count, 'pipeline.outputsReadyOne', 'pipeline.outputsReadyOther');
                      })()}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate(`/cases/${c.id}/review`)}>
                  <Icon name="rate_review" size="sm" />
                  {t('pipeline.reviewOutputs')}
                </Button>
              </div>
            )}

            {/* Error recovery — shown when any step failed */}
            {hasErrorStep && !runningStep && (
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-start gap-3 bg-error-container/50 border border-error/20 rounded-xl p-4">
                  <Icon name="warning" className="text-error shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-medium text-error">{t('pipeline.stepFailedTitle')}</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">
                      {hasNewSources
                        ? t('pipeline.retryWithSources')
                        : t('pipeline.retryAddSources')}
                    </p>
                  </div>
                </div>
                {hasNewSources && (
                  <Button variant="secondary" onClick={handleStart} disabled={isLaunching || isArchived} loading={isLaunching}>
                    <Icon name="refresh" size="sm" />
                    {isLaunching ? t('pipeline.starting') : t('pipeline.retry')}
                  </Button>
                )}
              </div>
            )}

            {/* Generate New Content — shown after a completed run when new sources exist */}
            {allDone && !runningStep && hasNewSources && (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleStart}
                disabled={isLaunching || isArchived}
                loading={isLaunching}
              >
                <Icon name="autorenew" size="sm" />
                {isLaunching ? t('pipeline.startingNew') : t('pipeline.generateNew')}
              </Button>
            )}

            {/* No new sources message after a completed run */}
            {allDone && !runningStep && !hasNewSources && c.sources.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-4 border bg-surface-container-low border-outline-variant/30">
                <Icon name="info" className="text-outline shrink-0 mt-0.5" />
                <p className="text-[13px] text-on-surface-variant">
                  {t('pipeline.noNewAfterPrefix')}
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    {t('pipeline.addNewSources')}
                  </button>
                  {t('pipeline.noNewAfterSuffix')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
