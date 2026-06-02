import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Card';
import { useContentCasesStore } from '../../stores/contentCasesStore';

const sourceTypeIcon: Record<string, string> = {
  text: 'notes',
  url:  'link',
  pdf:  'picture_as_pdf',
};

export function ContentCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const caseItem = useContentCasesStore(s => s.getCaseById(id ?? ''));

  if (!caseItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-on-surface-variant">Case not found.</p>
      </div>
    );
  }

  const c = caseItem;
  const canReview = c.status === 'in_review' || c.status === 'completed';
  const canPipeline = true; // Always show Pipeline access; label varies by status

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex gap-2">
            {canPipeline && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
                <Icon name={c.status === 'draft' ? 'play_arrow' : 'schema'} size="sm" />
                {c.status === 'draft' ? 'Start Pipeline' : 'Pipeline'}
              </Button>
            )}
            {canReview && (
              <Button size="sm" onClick={() => navigate(`/cases/${c.id}/review`)}>
                <Icon name="rate_review" size="sm" />
                Review Outputs
              </Button>
            )}
          </div>
        }
      />

      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Header card */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-sm flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CaseStatusBadge status={c.status} />
              <span className="text-[12px] text-on-surface-variant uppercase font-bold tracking-wider">{c.language}</span>
            </div>
            <h2 className="text-[28px] font-serif text-on-surface mb-2">{c.title}</h2>
            <p className="text-[14px] text-on-surface-variant">{c.targetAudience}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-[11px] text-on-surface-variant">
              Created {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Updated {new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-1 text-[12px] text-on-surface-variant">
              <Icon name="schedule" size="sm" className="text-outline" />
              <span className="capitalize">{c.schedule.frequency}</span>
              {c.schedule.time && <span>at {c.schedule.time}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Audience */}
            <Card accent className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="groups" className="text-outline" size="sm" />
                Audience
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Target</p>
                  <p className="text-[14px] text-on-surface mt-1">{c.targetAudience}</p>
                </div>
                <div>
                  <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Industry</p>
                  <p className="text-[14px] text-on-surface mt-1">{c.industry}</p>
                </div>
                <div>
                  <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Level</p>
                  <p className="text-[14px] text-on-surface mt-1 capitalize">{c.experienceLevel}</p>
                </div>
              </div>
            </Card>

            {/* Writing style */}
            <Card accent className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="edit_note" className="text-outline" size="sm" />
                Writing Style & Goals
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Style</p>
                  <p className="text-[14px] text-on-surface mt-1">{c.writingStyle}</p>
                </div>
                <div>
                  <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Goals</p>
                  <p className="text-[14px] text-on-surface mt-1">{c.goals}</p>
                </div>
                {c.aiInstructions && (
                  <div>
                    <p className="text-[11px] text-outline uppercase font-bold tracking-wider">AI Instructions</p>
                    <p className="text-[14px] text-on-surface mt-1 bg-surface-container-low rounded-lg p-3 italic">{c.aiInstructions}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Sources */}
            <Card accent className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="article" className="text-outline" size="sm" />
                Content Sources ({c.sources.length})
              </h4>
              {c.sources.length === 0 ? (
                <p className="text-[14px] text-outline">No sources added.</p>
              ) : (
                <div className="space-y-2">
                  {c.sources.map(source => (
                    <div key={source.id} className="flex items-start gap-3 p-3 bg-surface-container-low rounded-lg">
                      <Icon name={sourceTypeIcon[source.type]} className="text-outline shrink-0" size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-on-surface">{source.label}</p>
                        <p className="text-[12px] text-on-surface-variant truncate">{source.content}</p>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-2 py-0.5 rounded shrink-0">
                        {source.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Outputs summary */}
          <div className="space-y-4">
            <Card className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="auto_awesome" className="text-outline" size="sm" />
                Outputs
              </h4>

              {c.outputs.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center gap-3">
                  <Icon name="pending" size="xl" className="text-outline" />
                  <p className="text-[13px] text-on-surface-variant">
                    {c.status === 'draft'
                      ? 'Use the Start Pipeline button above to generate outputs.'
                      : 'Pipeline is running — outputs will appear here when complete.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {c.outputs.map(output => (
                    <div key={output.id} className="flex items-center gap-2 py-2 border-b border-outline-variant/20 last:border-0">
                      <PlatformBadge platform={output.platform} />
                      <div className="flex-1" />
                      <OutputStatusBadge status={output.status} />
                    </div>
                  ))}
                  {canReview && (
                    <Button
                      fullWidth
                      className="mt-3"
                      onClick={() => navigate(`/cases/${c.id}/review`)}
                    >
                      <Icon name="rate_review" size="sm" />
                      Review All
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Pipeline status */}
            <Card className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="schema" className="text-outline" size="sm" />
                Pipeline
              </h4>
              <div className="space-y-2">
                {c.pipeline.map(step => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={[
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs',
                      step.status === 'completed' ? 'bg-primary text-on-primary' :
                      step.status === 'running'   ? 'bg-secondary-container text-on-secondary-container' :
                      'bg-surface-container text-outline',
                    ].join(' ')}>
                      {step.status === 'completed' ? (
                        <Icon name="check" size="sm" />
                      ) : step.status === 'running' ? (
                        <span className="material-symbols-outlined text-xs animate-spin">refresh</span>
                      ) : (
                        <Icon name="circle" size="sm" />
                      )}
                    </div>
                    <p className={`text-[13px] capitalize ${step.status === 'idle' ? 'text-outline' : 'text-on-surface'}`}>
                      {step.name.replace('_', ' ')}
                    </p>
                    {step.confidence && (
                      <span className="ml-auto text-[11px] text-primary font-bold">{step.confidence}%</span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" fullWidth className="mt-4" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
                {c.status === 'draft' ? 'Start Pipeline' : 'View Pipeline'}
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
