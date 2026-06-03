import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
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
  const statusColor = {
    idle:      'border-outline-variant/30 bg-surface-container-lowest',
    running:   'border-primary/30 bg-primary-fixed/20',
    completed: 'border-green-300 bg-green-50/50',
    error:     'border-error/30 bg-error-container/20',
  }[step.status];
  const iconBg = {
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
           step.status === 'completed' ? <Icon name="check" /> :
           <Icon name={meta.icon} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[18px] font-serif font-medium text-on-surface">{meta.title}</h3>
            <StatusChip status={step.status} />
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

function StatusChip({ status }: { status: PipelineStep['status'] }) {
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
  const caseItem            = useContentCasesStore(s => s.getCaseById(id ?? ''));
  const loading             = useContentCasesStore(s => s.loading);
  const fetchCaseById       = useContentCasesStore(s => s.fetchCaseById);
  const startPipeline       = useContentCasesStore(s => s.startPipeline);
  const advancePipelineStep = useContentCasesStore(s => s.advancePipelineStep);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting]     = useState(false);

  const runningStep   = caseItem?.pipeline.find(s => s.status === 'running');
  const allDone       = caseItem?.pipeline.every(s => s.status === 'completed');
  const newSources    = caseItem?.sources.filter(s => s.status === 'new') ?? [];
  const usedSources   = caseItem?.sources.filter(s => s.status === 'used') ?? [];
  const hasNewSources = newSources.length > 0;

  // Fetch the case if not in store (e.g. direct URL navigation or page refresh)
  useEffect(() => {
    if (!caseItem && id) fetchCaseById(id);
  }, [id, caseItem, fetchCaseById]);

  // Auto-advance: when a step is running, call advancePipelineStep after 3s.
  // Depends on runningStep?.id so it re-fires each time a NEW step becomes active.
  useEffect(() => {
    if (!runningStep || !id) return;
    const t = setTimeout(() => advancePipelineStep(id), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningStep?.id, id]);

  if (!caseItem) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-on-surface-variant">
        {loading
          ? <><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">Loading…</span></>
          : <p className="text-[14px]">Case not found.</p>}
      </div>
    );
  }

  const c = caseItem;

  async function handleStart() {
    if (!id || starting) return;
    setStartError(null);
    setStarting(true);
    try {
      await startPipeline(id);
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

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h3 className="text-[22px] font-serif text-on-surface mb-1">Content Pipeline</h3>
            <p className="text-[14px] text-on-surface-variant">
              Research, Fact Check, and Content Creation run in sequence using new sources as primary material.
            </p>
          </div>

          {/* Source selection info */}
          {run ? (
            // Active or completed run: show which sources were selected
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
            {/* Initial start — only for brand-new draft cases */}
            {c.status === 'draft' && !allDone && !runningStep && (
              <Button
                fullWidth
                onClick={handleStart}
                disabled={!hasNewSources || starting}
                loading={starting}
              >
                <Icon name="play_arrow" size="sm" />
                {starting ? 'Starting…' : 'Start Pipeline'}
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
                        return `${count} draft${count !== 1 ? 's' : ''} generated and ready for review.`;
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

            {/* Generate New Content — shown after a completed run when new sources exist */}
            {allDone && !runningStep && hasNewSources && (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleStart}
                disabled={starting}
                loading={starting}
              >
                <Icon name="autorenew" size="sm" />
                {starting ? 'Starting new run…' : 'Generate New Content'}
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
