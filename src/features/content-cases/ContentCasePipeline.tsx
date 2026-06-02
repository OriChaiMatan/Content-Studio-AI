import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { PipelineStep } from '../../types';

const stepMeta: Record<PipelineStep['name'], { icon: string; title: string; description: string }> = {
  research: {
    icon: 'search',
    title: 'Research',
    description: 'Analyzing your sources and extracting key information, themes, and supporting data.',
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

function StepCard({ step, isActive }: { step: PipelineStep; isActive: boolean }) {
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
    <div className={`rounded-xl border p-6 transition-all ${statusColor} ${isActive ? 'shadow-md' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {step.status === 'running' ? (
            <span className="material-symbols-outlined animate-spin">{meta.icon}</span>
          ) : step.status === 'completed' ? (
            <Icon name="check" />
          ) : (
            <Icon name={meta.icon} />
          )}
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
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${step.confidence}%` }}
                    />
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
    idle:      { label: 'Waiting',    bg: 'bg-surface-container text-on-surface-variant' },
    running:   { label: 'Running',    bg: 'bg-primary-fixed/60 text-primary' },
    completed: { label: 'Completed',  bg: 'bg-green-100 text-green-700' },
    error:     { label: 'Error',      bg: 'bg-error-container text-on-error-container' },
  }[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div className="flex justify-center my-1">
      <div className={`w-0.5 h-6 rounded-full ${done ? 'bg-green-400' : 'bg-outline-variant'}`} />
    </div>
  );
}

export function ContentCasePipeline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const caseItem = useContentCasesStore(s => s.getCaseById(id ?? ''));
  const advancePipeline = useContentCasesStore(s => s.advancePipeline);
  const runningStep = caseItem?.pipeline.find(s => s.status === 'running');
  const allDone     = caseItem?.pipeline.every(s => s.status === 'completed');

  // Auto-advance: whenever a step is "running", schedule its completion after 3 seconds.
  // Depends on runningStep.id so it re-fires each time a new step becomes active.
  useEffect(() => {
    if (!runningStep || !id) return;
    const t = setTimeout(() => advancePipeline(id), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningStep?.id, id]);

  if (!caseItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-on-surface-variant">Case not found.</p>
      </div>
    );
  }

  const c = caseItem;

  function handleStart() {
    if (!id) return;
    advancePipeline(id);
  }

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
              Research, Fact Check, and Content Creation run in sequence using all sources in this workspace.
            </p>
          </div>

          {/* Source count context */}
          <div className={[
            'flex items-center gap-3 rounded-xl p-4 mb-6 border',
            c.sources.length === 0
              ? 'bg-surface-container-low border-outline-variant/30'
              : 'bg-primary-fixed/20 border-primary/20',
          ].join(' ')}>
            <Icon
              name="article"
              className={c.sources.length === 0 ? 'text-outline' : 'text-primary'}
            />
            <div>
              {c.sources.length === 0 ? (
                <>
                  <p className="text-[14px] font-medium text-on-surface-variant">No sources added yet</p>
                  <p className="text-[12px] text-outline">
                    You can still run the pipeline — or{' '}
                    <button
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="text-primary underline hover:no-underline"
                    >
                      go back to the workspace
                    </button>{' '}
                    to add sources first.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-medium text-on-surface">
                    <span className="font-bold">{c.sources.length}</span>{' '}
                    source{c.sources.length !== 1 ? 's' : ''} ready for this run
                  </p>
                  <p className="text-[12px] text-on-surface-variant">
                    All sources collected in this workspace will be processed.{' '}
                    <button
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="text-primary underline hover:no-underline"
                    >
                      Add more sources
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Pipeline steps */}
          <div>
            {c.pipeline.map((step, i) => (
              <div key={step.id}>
                <StepCard
                  step={step}
                  isActive={step.status === 'running'}
                />
                {i < c.pipeline.length - 1 && (
                  <ConnectorLine done={step.status === 'completed'} />
                )}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center gap-4">
            {c.status === 'draft' && (
              <Button onClick={handleStart} fullWidth>
                <Icon name="play_arrow" size="sm" />
                Start Pipeline
              </Button>
            )}

            {runningStep && (
              <div className="flex-1 text-center text-[14px] text-on-surface-variant">
                Processing… this simulates AI running in the background.
              </div>
            )}

            {allDone && (
              <>
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl p-4">
                  <Icon name="check_circle" className="text-green-600" />
                  <div>
                    <p className="text-[14px] font-medium text-green-800">All steps complete!</p>
                    <p className="text-[12px] text-green-700">Your content drafts are ready for review.</p>
                  </div>
                </div>
                <Button onClick={() => navigate(`/cases/${c.id}/review`)}>
                  <Icon name="rate_review" size="sm" />
                  Review Outputs
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
