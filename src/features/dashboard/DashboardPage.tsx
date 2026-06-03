import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { CaseStatus } from '../../types';

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent = 'bg-primary' }: StatCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center text-on-primary shrink-0`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-[11px] uppercase font-bold text-outline tracking-wider mb-1">{label}</p>
        <p className="text-[32px] font-serif text-on-surface leading-none">{value}</p>
        {sub && <p className="text-[12px] text-on-surface-variant mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const pipelineStatusLabel: Record<CaseStatus, string> = {
  draft:       'Not started',
  research:    'Researching…',
  fact_check:  'Fact checking…',
  generating:  'Generating…',
  in_review:   'Ready for review',
  completed:   'Completed',
};

const pipelineStatusIcon: Record<CaseStatus, string> = {
  draft:       'pending',
  research:    'search',
  fact_check:  'fact_check',
  generating:  'auto_awesome',
  in_review:   'rate_review',
  completed:   'check_circle',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const cases      = useContentCasesStore(s => s.cases);
  const loading    = useContentCasesStore(s => s.loading);
  const libraryRuns  = useLibraryStore(s => s.runs);
  const user = useSettingsStore(s => s.user);

  const inReview    = cases.filter(c => c.status === 'in_review').length;
  const inProgress  = cases.filter(c => ['research', 'fact_check', 'generating'].includes(c.status)).length;
  const approved    = libraryRuns.reduce((n, r) => n + r.approvedCount, 0);
  const recentCases = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <>
      <TopBar title="Dashboard" />

      <main className="flex-1 p-8 space-y-8 overflow-y-auto">

        {/* Loading overlay — shown only while initial fetch is in progress */}
        {loading && cases.length === 0 && (
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">refresh</span>
            <span className="text-[14px]">Loading dashboard…</span>
          </div>
        )}

        {/* Welcome */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[22px] font-serif text-on-surface">
              Welcome back, {user.name.split(' ')[0]}
            </h3>
            <p className="text-[14px] text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Button onClick={() => navigate('/cases/new')}>
            <Icon name="add" size="sm" />
            New Content Case
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="folder_open"  label="Total Cases"   value={cases.length}  sub="All time" />
          <StatCard icon="rate_review"  label="In Review"     value={inReview}       sub="Awaiting approval"   accent="bg-secondary" />
          <StatCard icon="auto_awesome" label="In Progress"   value={inProgress}     sub="Pipeline running"    accent="bg-tertiary" />
          <StatCard icon="auto_stories" label="In Library"    value={approved}       sub="Approved pieces"     accent="bg-primary-container" />
        </div>

        {/* Active pipeline */}
        {inProgress > 0 && (
          <section>
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Active Pipeline</h4>
            <div className="space-y-2">
              {cases.filter(c => ['research', 'fact_check', 'generating'].includes(c.status)).map(c => (
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
                    <p className="text-[12px] text-on-surface-variant">{pipelineStatusLabel[c.status]}</p>
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

        {/* Ready for review */}
        {inReview > 0 && (
          <section>
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Ready for Review</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases.filter(c => c.status === 'in_review').map(c => (
                <div
                  key={c.id}
                  className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-l-4 border-l-green-400"
                  onClick={() => navigate(`/cases/${c.id}/review`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="text-[16px] font-medium text-on-surface">{c.title}</h5>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <p className="text-[13px] text-on-surface-variant mb-4 line-clamp-2">{c.goals}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-on-surface-variant">
                      {c.outputs.filter(o => o.status === 'draft').length} drafts pending
                    </span>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/cases/${c.id}/review`); }}>
                      Review Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent cases table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider">Recent Cases</h4>
            <button
              onClick={() => navigate('/cases')}
              className="text-[14px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline">Case</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline hidden md:table-cell">Language</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-outline hidden lg:table-cell">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {recentCases.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-container/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-medium text-on-surface">{c.title}</p>
                      <p className="text-[12px] text-on-surface-variant">{c.industry}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[13px] text-on-surface-variant uppercase">{c.language}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[13px] text-on-surface-variant">
                        {new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Icon name="chevron_right" className="text-outline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
