import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { CaseStatus, ContentCase, ContentGoal, Platform, Schedule } from '../../types';

const GOAL_LABELS: Record<ContentGoal, string> = {
  build_authority: 'Build Authority', generate_leads: 'Generate Leads',
  increase_sales: 'Increase Sales', educate_audience: 'Educate Audience',
  grow_community: 'Grow Community', personal_branding: 'Personal Branding',
  other: 'Other',
};

const STATUS_FILTERS: { value: CaseStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'research',  label: 'Researching' },
  { value: 'fact_check',label: 'Fact Checking' },
  { value: 'generating',label: 'Generating' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
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

function goalLabel(c: ContentCase): string {
  if (c.contentGoal === 'other' && c.goalCustom) return c.goalCustom;
  return GOAL_LABELS[c.contentGoal];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function humanizeSchedule(s: Schedule): string {
  switch (s.frequency) {
    case 'manual':  return 'Manual';
    case 'daily':   return s.time ? `Daily · ${s.time}` : 'Daily';
    case 'weekly':  return `Weekly · ${DOW[s.dayOfWeek ?? 1]}${s.time ? ` ${s.time}` : ''}`;
    case 'monthly': return `Monthly · Day ${s.dayOfMonth ?? 1}${s.time ? ` ${s.time}` : ''}`;
    default:        return 'Manual';
  }
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// State-aware primary CTA — chosen from real state, in priority order.
interface CaseCta { label: string; icon: string; to: string; variant: 'primary' | 'secondary'; }
function caseCta(c: ContentCase): CaseCta {
  if (pendingDrafts(c) > 0)
    return { label: 'Review Content', icon: 'rate_review', to: `/cases/${c.id}/review`, variant: 'primary' };
  if (IN_PROGRESS_STATUSES.includes(c.status))
    return { label: 'View Pipeline', icon: 'visibility', to: `/cases/${c.id}/pipeline`, variant: 'secondary' };
  if (c.sources.length === 0)
    return { label: 'Add Sources', icon: 'note_add', to: `/cases/${c.id}`, variant: 'primary' };
  return { label: 'Open Case', icon: 'open_in_new', to: `/cases/${c.id}`, variant: 'secondary' };
}

export function ContentCasesPage() {
  const navigate = useNavigate();
  const cases   = useContentCasesStore(s => s.cases);
  const loading = useContentCasesStore(s => s.loading);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  // Status match — 'in_review' uses REAL pending drafts, not case.status.
  function matchesStatus(c: ContentCase): boolean {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in_review') return pendingDrafts(c) > 0;
    return c.status === statusFilter;
  }

  // Pill count — same output-accurate logic for 'in_review'.
  function countFor(value: CaseStatus): number {
    if (value === 'in_review') return cases.filter(c => pendingDrafts(c) > 0).length;
    return cases.filter(c => c.status === value).length;
  }

  const filtered = cases.filter(c => {
    if (!matchesStatus(c)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.industry.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
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
                        <p className="text-[12px] text-on-surface-variant mt-0.5 truncate">{goalLabel(c)}</p>
                      </div>
                      <CaseStatusBadge status={c.status} />
                    </div>

                    {/* Platforms */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4 min-h-[20px]">
                      {platforms.length > 0 ? (
                        <>
                          {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                          {planned.length > 0 && (
                            <span className="text-[10px] uppercase tracking-wide text-outline">Planned</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[12px] text-outline">No platforms yet</span>
                      )}
                    </div>

                    {/* Approval progress */}
                    {currentOutputs.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
                          <span>Approval</span>
                          <span><span className="font-medium text-on-surface">{approvedCount}</span>/{currentOutputs.length} approved</span>
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
                        {c.sources.length} source{c.sources.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 min-w-0">
                        <Icon name="schedule" size="sm" className="text-outline" />
                        <span className="truncate">{humanizeSchedule(c.schedule)}</span>
                      </span>
                    </div>

                    {/* Last updated / last run */}
                    <p className="text-[11px] text-outline mt-2">
                      {ranAt ? `Last run ${relativeDate(ranAt)}` : `Updated ${relativeDate(c.updatedAt)}`}
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
                        {cta.label}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New case tile — intentional, primary-tinted affordance */}
            <button
              type="button"
              onClick={() => navigate('/cases/new')}
              className="group border-2 border-dashed border-outline-variant rounded-xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[200px] hover:border-primary hover:bg-primary-container/20"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center text-outline transition-colors">
                <Icon name="add" size="lg" />
              </div>
              <p className="text-[14px] font-medium text-on-surface-variant group-hover:text-primary transition-colors">
                New Content Case
              </p>
              <p className="text-[12px] text-outline">Start collecting sources and generating content</p>
            </button>
          </div>
        )}
      </main>
    </>
  );
}
