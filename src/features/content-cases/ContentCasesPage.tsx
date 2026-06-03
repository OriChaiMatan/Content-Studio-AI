import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { CaseStatus } from '../../types';

const STATUS_FILTERS: { value: CaseStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'research',  label: 'Researching' },
  { value: 'fact_check',label: 'Fact Checking' },
  { value: 'generating',label: 'Generating' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
];

const statusProgress: Record<CaseStatus, number> = {
  draft: 0, research: 25, fact_check: 50, generating: 75, in_review: 90, completed: 100,
};

export function ContentCasesPage() {
  const navigate = useNavigate();
  const cases   = useContentCasesStore(s => s.cases);
  const loading = useContentCasesStore(s => s.loading);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = cases.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.industry.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleCaseAction(e: React.MouseEvent, caseId: string, status: CaseStatus) {
    e.stopPropagation();
    if (status === 'in_review') navigate(`/cases/${caseId}/review`);
    else if (['draft', 'research', 'fact_check', 'generating'].includes(status)) navigate(`/cases/${caseId}/pipeline`);
    else navigate(`/cases/${caseId}`);
  }

  return (
    <>
      <TopBar
        title="Content Cases"
        searchPlaceholder="Search cases..."
        onSearch={setQuery}
        actions={
          <Button onClick={() => navigate('/cases/new')}>
            <Icon name="add" size="sm" />
            New Case
          </Button>
        }
      />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Loading state */}
        {loading && cases.length === 0 && (
          <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">refresh</span>
            <span className="text-[14px]">Loading cases…</span>
          </div>
        )}

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
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1.5 text-[11px] opacity-70">
                  ({cases.filter(c => c.status === f.value).length})
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
            <p className="text-[16px] font-medium text-on-surface-variant">No cases found</p>
            <p className="text-[14px] text-outline mt-1">Try a different filter or create a new case</p>
            <Button className="mt-6" onClick={() => navigate('/cases/new')}>
              <Icon name="add" size="sm" />
              New Content Case
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(c => {
              const progress = statusProgress[c.status];
              const approvedCount = c.outputs.filter(o => o.status === 'approved').length;

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                >
                  {/* Progress bar */}
                  <div className="h-1 bg-surface-container-high">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-2">
                        <h3 className="text-[16px] font-medium text-on-surface truncate">{c.title}</h3>
                        <p className="text-[12px] text-on-surface-variant mt-0.5">{c.industry}</p>
                      </div>
                      <CaseStatusBadge status={c.status} />
                    </div>

                    {/* Goals */}
                    <p className="text-[13px] text-on-surface-variant line-clamp-2 mb-4">{c.goals || c.targetAudience}</p>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-[12px] text-on-surface-variant border-t border-outline-variant/30 pt-3">
                      <div className="flex items-center gap-1">
                        <Icon name="article" size="sm" className="text-outline" />
                        <span>{c.sources.length} source{c.sources.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="check_circle" size="sm" className={approvedCount > 0 ? 'text-primary' : 'text-outline'} />
                        <span>{approvedCount}/{c.outputs.length} approved</span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Icon name="schedule" size="sm" className="text-outline" />
                        <span className="uppercase">{c.schedule.frequency}</span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.status === 'in_review' ? (
                        <Button
                          size="sm"
                          fullWidth
                          onClick={e => handleCaseAction(e, c.id, c.status)}
                        >
                          <Icon name="rate_review" size="sm" />
                          Review Outputs
                        </Button>
                      ) : c.status === 'draft' ? (
                        <Button
                          size="sm"
                          fullWidth
                          onClick={e => handleCaseAction(e, c.id, c.status)}
                        >
                          <Icon name="play_arrow" size="sm" />
                          Start Pipeline
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          fullWidth
                          variant="secondary"
                          onClick={e => handleCaseAction(e, c.id, c.status)}
                        >
                          <Icon name="visibility" size="sm" />
                          View Pipeline
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New case card */}
            <div
              onClick={() => navigate('/cases/new')}
              className="border-2 border-dashed border-outline-variant rounded-xl p-5 flex flex-col items-center justify-center gap-4 hover:bg-surface-container/50 cursor-pointer transition-colors min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <Icon name="add" size="lg" />
              </div>
              <p className="text-[14px] font-medium text-outline">New Content Case</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
