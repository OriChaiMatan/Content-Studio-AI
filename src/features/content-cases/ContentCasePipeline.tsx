import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLiveCase } from './useLiveCase';
import { ApiError } from '../../lib/api';
import type { PipelineStep } from '../../types';

// ── Step metadata ─────────────────────────────────────────

const stepMeta: Record<PipelineStep['name'], { icon: string; title: string; description: string }> = {
  research: {
    icon: 'search',
    title: 'Research',
    description: 'Analyzing primary sources and extracting key information, themes, and supporting data.',
  },
  fact_check: {
    icon: 'fact_check',
    title: 'Fact Check',
    description: 'Cross-referencing all claims against trusted knowledge sources to ensure accuracy.',
  },
  content_creation: {
    icon: 'auto_awesome',
    title: 'Content Creation',
    description: 'Generating platform-specific drafts tailored to your audience and writing style.',
  },
};

// ── Step card ─────────────────────────────────────────────

function StepCard({ step }: { step: PipelineStep }) {
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
            <h3 className="text-[18px] font-serif font-medium text-on-surface">{meta.title}</h3>
            <StatusChip status={step.status} degraded={degradedResearch} />
          </div>
          <p className="text-[14px] text-on-surface-variant">{meta.description}</p>
          {step.status === 'running' && (
            <div className="mt-4">
              <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-[12px] text-on-surface-variant mt-2">Processing…</p>
            </div>
          )}

          {step.status === 'error' && step.summary && (
            <div className="mt-4 bg-error-container/40 border border-error/20 rounded-lg p-4">
              <p className="text-[12px] font-medium text-error mb-1">Step failed</p>
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
                  <span className="text-[12px] font-bold text-primary shrink-0">{step.confidence}% confidence</span>
                </div>
              )}
            </div>
          )}
          {/* Phase 10D.0 — research integrity: did the thesis competition actually run? */}
          {step.research && step.status !== 'running' && step.status !== 'idle' && (
            step.research.status === 'degraded' ? (
              <div className="mt-3 bg-amber-100/70 border border-amber-300 rounded-lg p-3">
                <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1">
                  <Icon name="warning" size="sm" /> Thesis competition unavailable — research fallback used
                </p>
                <p className="text-[12px] text-amber-900 mt-1">
                  Synthesis fell back to mock ({step.research.generatorVersion}). The thesis was not competed; any content below is built on a mock thesis, not real cross-source synthesis.
                </p>
              </div>
            ) : step.research.status === 'success' ? (
              <p className="text-[12px] text-green-700 mt-2 flex items-center gap-1">
                <Icon name="check" size="sm" /> Thesis competition executed — {step.research.candidateCount} candidate{step.research.candidateCount !== 1 ? 's' : ''} evaluated
              </p>
            ) : (
              <p className="text-[12px] text-on-surface-variant mt-2">
                Synthesis disabled — deterministic mock used (no thesis competition).
              </p>
            )
          )}
          {step.completedAt && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              Completed at {new Date(step.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, degraded }: { status: PipelineStep['status']; degraded?: boolean }) {
  if (degraded) {
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">Degraded</span>;
  }
  const cfg = {
    idle:      { label: 'Waiting',   bg: 'bg-surface-container text-on-surface-variant' },
    running:   { label: 'Running',   bg: 'bg-primary-fixed/60 text-primary' },
    completed: { label: 'Completed', bg: 'bg-green-100 text-green-700' },
    error:     { label: 'Error',     bg: 'bg-error-container text-on-error-container' },
  }[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg}`}>{cfg.label}</span>;
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
          ? <><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">Loading…</span></>
          : <p className="text-[14px]">Case not found.</p>}
      </div>
    );
  }

  const c = view;

  // Default to the case language for backward compatibility, else English.
  const effectiveLang: 'en' | 'he' = outputLanguage ?? (c.language === 'he' ? 'he' : 'en');

  async function handleStart() {
    if (!id || starting || runnerActive) return;
    setStartError(null);
    setStarting(true);
    try {
      await runPipeline(id, effectiveLang);
      // 202 accepted — begin bootstrap polling immediately, even though the detached
      // runner may not have flipped the case to 'research' in the DB yet.
      setRunnerActive(true);
    } catch (err) {
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
              Back to Case
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h3 className="text-[22px] font-serif text-on-surface mb-1">Content Pipeline</h3>
            <p className="text-[14px] text-on-surface-variant">
              Research, Fact Check, and Content Creation run in sequence using new sources as primary material.
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
                  <span className="font-bold text-primary">{run.primarySourceIds.length}</span> new source{run.primarySourceIds.length !== 1 ? 's' : ''} selected as primary
                  {run.contextSourceIds.length > 0 && (
                    <span className="text-on-surface-variant font-normal">
                      {' '}· <span className="font-bold">{run.contextSourceIds.length}</span> previous source{run.contextSourceIds.length !== 1 ? 's' : ''} as context
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  Content is generated primarily from the new sources. Previous sources provide background context only.
                </p>
              </div>
            </div>
          ) : !hasNewSources && c.sources.length > 0 ? (
            // No new sources, but has used sources
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-surface-container-low border-outline-variant/30">
              <Icon name="warning" className="text-outline shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface-variant">No new sources available</p>
                <p className="text-[12px] text-outline mt-0.5">
                  All {c.sources.length} source{c.sources.length !== 1 ? 's' : ''} in this workspace have already been used in a previous run.{' '}
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    Add new sources
                  </button>{' '}
                  to generate fresh content.
                </p>
              </div>
            </div>
          ) : c.sources.length === 0 ? (
            // No sources at all
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-surface-container-low border-outline-variant/30">
              <Icon name="article" className="text-outline shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface-variant">No sources added yet</p>
                <p className="text-[12px] text-outline mt-0.5">
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    Add sources
                  </button>{' '}
                  before running the pipeline to get the best results.
                </p>
              </div>
            </div>
          ) : (
            // Has new sources, not yet started
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border bg-primary-fixed/20 border-primary/20">
              <Icon name="article" className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-on-surface">
                  <span className="font-bold text-primary">{newSources.length}</span> new source{newSources.length !== 1 ? 's' : ''} ready
                  {usedSources.length > 0 && <span className="text-on-surface-variant font-normal"> · {usedSources.length} previous source{usedSources.length !== 1 ? 's' : ''} will be used as context</span>}
                </p>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  New sources will be the primary material. Previous sources provide background context.
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
                <span className="text-[13px] font-medium text-on-surface-variant">Output language:</span>
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
                disabled={!hasNewSources || isLaunching}
                loading={isLaunching}
              >
                <Icon name="play_arrow" size="sm" />
                {isLaunching ? 'Starting…' : 'Start Pipeline'}
              </Button>
            )}

            {/* Running message */}
            {runningStep && !allDone && (
              <div className="text-center text-[14px] text-on-surface-variant">
                Processing… simulating AI pipeline in the background.
              </div>
            )}

            {/* Completion banner + Review button */}
            {allDone && (
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl p-4">
                  <Icon name="check_circle" className="text-green-600" />
                  <div>
                    <p className="text-[14px] font-medium text-green-800">All steps complete!</p>
                    <p className="text-[12px] text-green-700">
                      {(() => {
                        const currentRunId = c.currentRun?.id;
                        const count = currentRunId
                          ? c.outputs.filter(o => o.pipelineRunId === currentRunId).length
                          : c.outputs.length;
                        return `${count} output${count !== 1 ? 's' : ''} generated and ready for review.`;
                      })()}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate(`/cases/${c.id}/review`)}>
                  <Icon name="rate_review" size="sm" />
                  Review Outputs
                </Button>
              </div>
            )}

            {/* Error recovery — shown when any step failed */}
            {hasErrorStep && !runningStep && (
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-start gap-3 bg-error-container/50 border border-error/20 rounded-xl p-4">
                  <Icon name="warning" className="text-error shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-medium text-error">Pipeline step failed</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">
                      {hasNewSources
                        ? 'Start a new run to try again with the available sources.'
                        : 'Add new sources, then start a new run to try again.'}
                    </p>
                  </div>
                </div>
                {hasNewSources && (
                  <Button variant="secondary" onClick={handleStart} disabled={isLaunching} loading={isLaunching}>
                    <Icon name="refresh" size="sm" />
                    {isLaunching ? 'Starting…' : 'Retry'}
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
                disabled={isLaunching}
                loading={isLaunching}
              >
                <Icon name="autorenew" size="sm" />
                {isLaunching ? 'Starting new run…' : 'Generate New Content'}
              </Button>
            )}

            {/* No new sources message after a completed run */}
            {allDone && !runningStep && !hasNewSources && c.sources.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-4 border bg-surface-container-low border-outline-variant/30">
                <Icon name="info" className="text-outline shrink-0 mt-0.5" />
                <p className="text-[13px] text-on-surface-variant">
                  No new sources available.{' '}
                  <button onClick={() => navigate(`/cases/${c.id}`)} className="text-primary underline hover:no-underline">
                    Add new sources
                  </button>{' '}
                  to generate new content.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
