import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Card';
import { SourcesPanel } from './SourcesPanel';
import { useLiveCase } from './useLiveCase';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { api } from '../../lib/api';
import type { ContentGoal, ContentStyle, ContentTarget, Language, ContentCase, ContentOutput, PipelineStep, Platform, RunSummary, Schedule, ScheduleFrequency, CaseStatus } from '../../types';

// ── Human-readable labels for new enum fields ─────────────

const GOAL_LABELS: Record<ContentGoal, string> = {
  build_authority: 'Build Authority', generate_leads: 'Generate Leads',
  increase_sales: 'Increase Sales', educate_audience: 'Educate Audience',
  grow_community: 'Grow Community', personal_branding: 'Personal Branding',
  other: 'Other',
};

const STYLE_LABELS: Record<ContentStyle, string> = {
  professional: 'Professional', authoritative: 'Authoritative',
  friendly: 'Friendly', personal: 'Personal', journalistic: 'Journalistic',
  provocative: 'Provocative', humorous: 'Humorous', other: 'Other',
};

const TARGET_LABELS: Record<ContentTarget, string> = {
  linkedin: 'LinkedIn', facebook: 'Facebook',
  newsletter: 'Newsletter', podcast: 'Podcast', images: 'Images',
};

const TARGET_ICONS: Record<ContentTarget, string> = {
  linkedin: 'work', facebook: 'groups',
  newsletter: 'email', podcast: 'mic', images: 'image',
};

// Schedule editing (inline; mirrors the create wizard's Step 3 — not extracted yet).
const FREQ_OPTIONS: { value: ScheduleFrequency; label: string; icon: string }[] = [
  { value: 'manual',  label: 'Manual',  icon: 'touch_app' },
  { value: 'daily',   label: 'Daily',   icon: 'today' },
  { value: 'weekly',  label: 'Weekly',  icon: 'date_range' },
  { value: 'monthly', label: 'Monthly', icon: 'calendar_month' },
];
const DOW_OPTIONS = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// ── Derived helpers (frontend-only; real output/run/source data) ──────────────

const IN_PROGRESS_STATUSES: CaseStatus[] = ['research', 'fact_check', 'generating'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function runOutputs(c: ContentCase): ContentOutput[] {
  return c.currentRun ? c.outputs.filter(o => o.pipelineRunId === c.currentRun!.id) : c.outputs;
}
function pendingDraftsOf(c: ContentCase): number {
  return runOutputs(c).filter(o => o.status === 'draft').length;
}

function humanizeSchedule(s: Schedule): string {
  switch (s.frequency) {
    case 'manual':  return 'Manual';
    case 'daily':   return s.time ? `Daily · ${s.time}` : 'Daily';
    case 'weekly':  return `Weekly · ${DOW_SHORT[s.dayOfWeek ?? 1]}${s.time ? ` ${s.time}` : ''}`;
    case 'monthly': return `Monthly · Day ${s.dayOfMonth ?? 1}${s.time ? ` ${s.time}` : ''}`;
    default:        return 'Manual';
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Meaningful per-step state label (replaces abstract confidence %).
const STEP_LABELS: Record<string, { idle: string; running: string; completed: string; error: string }> = {
  research:         { idle: 'Research Pending',    running: 'Researching…',      completed: 'Research Complete',    error: 'Research Failed' },
  fact_check:       { idle: 'Fact Check Pending',  running: 'Fact Checking…',    completed: 'Fact Check Complete',  error: 'Fact Check Failed' },
  content_creation: { idle: 'Content Pending',     running: 'Generating…',       completed: 'Content Generated',    error: 'Generation Failed' },
};
function stepLabel(step: PipelineStep): string {
  return STEP_LABELS[step.name]?.[step.status] ?? step.name.replace('_', ' ');
}

// Research integrity → High / Medium / Low (from the research step's integrity, or confidence).
function researchIntegrityLevel(step: PipelineStep): { label: 'High' | 'Medium' | 'Low'; color: string } | null {
  if (step.name !== 'research' || step.status !== 'completed') return null;
  const r = step.research;
  if (r) {
    if (r.degraded || r.status === 'degraded') return { label: 'Low', color: 'text-error' };
    if (r.status === 'mock') return { label: 'Medium', color: 'text-amber-600' };
    return { label: 'High', color: 'text-green-700' };
  }
  if (step.confidence != null) {
    if (step.confidence >= 80) return { label: 'High', color: 'text-green-700' };
    if (step.confidence >= 50) return { label: 'Medium', color: 'text-amber-600' };
    return { label: 'Low', color: 'text-error' };
  }
  return null;
}

const RUNNING_LABEL: Record<string, string> = {
  research: 'Researching…', fact_check: 'Fact checking…', generating: 'Generating content…',
};
function prettyStepName(name: string): string {
  return name === 'content_creation' ? 'content generation' : name.replace('_', ' ');
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

  const caseItem    = useLiveCase(id);
  const loading     = useContentCasesStore(s => s.loading);
  const refreshCase = useContentCasesStore(s => s.refreshCase);
  const deleteCase  = useContentCasesStore(s => s.deleteCase);

  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [configOpen,      setConfigOpen]      = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);

  const sourcesRef = useRef<HTMLDivElement>(null);
  function scrollToSources() {
    sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Early return — not found / loading (with TopBar + a way back) ────────────
  if (!caseItem) {
    return (
      <>
        <TopBar title="Content Case" />
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          {loading ? (
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="text-[14px]">Loading case…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <Icon name="search_off" size="xl" className="text-outline" />
              </div>
              <div>
                <p className="text-[16px] font-medium text-on-surface">Case not found</p>
                <p className="text-[13px] text-on-surface-variant mt-1">It may have been deleted or the link is incorrect.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}>
                <Icon name="arrow_back" size="sm" />
                Back to Cases
              </Button>
            </div>
          )}
        </main>
      </>
    );
  }

  const c = caseItem;
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
    statusHeadline = `Run failed at ${prettyStepName(failedStep.name)}`;
    statusTone = 'error';
  } else if (isRunning) {
    statusHeadline = RUNNING_LABEL[c.status] ?? 'Pipeline running…';
    statusTone = 'active';
  } else if (pending > 0) {
    statusHeadline = `${pending} draft${pending !== 1 ? 's' : ''} ready for review`;
    statusTone = 'ready';
  } else if (c.status === 'completed') {
    statusHeadline = 'Completed — all outputs reviewed';
  } else if (c.status === 'in_review') {
    statusHeadline = 'All outputs reviewed';
  } else if (c.status === 'draft') {
    statusHeadline = c.sources.length === 0 ? 'Draft — add sources to begin' : 'Ready to generate';
  } else {
    statusHeadline = '';
  }

  // ── "What should I do next?" — single state-aware primary action ──
  const cta: { label: string; icon: string; run: () => void } = (() => {
    if (pending > 0)            return { label: 'Review Content', icon: 'rate_review', run: () => navigate(`/cases/${c.id}/review`) };
    if (isRunning)             return { label: 'View Pipeline',  icon: 'visibility',  run: () => navigate(`/cases/${c.id}/pipeline`) };
    if (c.sources.length === 0) return { label: 'Add Sources',    icon: 'note_add',    run: scrollToSources };
    if (newSources > 0)        return { label: c.status === 'draft' ? 'Start Pipeline' : 'Generate Now', icon: 'play_arrow', run: () => navigate(`/cases/${c.id}/pipeline`) };
    return { label: 'View in Library', icon: 'auto_stories', run: () => navigate('/library') };
  })();

  async function handleDeleteCase() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCase(c.id);
      navigate('/cases');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete case. Please try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const aboutLine = [GOAL_LABELS[c.contentGoal], c.targetAudience].filter(Boolean).join(' · ');

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2 bg-error-container/60 border border-error/20 rounded-xl px-3 py-1.5">
                <span className="text-[12px] text-error font-medium">Delete this case?</span>
                <Button variant="danger" size="sm" onClick={handleDeleteCase} loading={deleting} disabled={deleting}>Confirm</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-lg hover:bg-error-container/30"
                title="Delete case"
              >
                <Icon name="delete" size="sm" />
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
              <Icon name="schema" size="sm" />
              Pipeline
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

        {/* ── A. Smart header: about · status · next action ─────────── */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <CaseStatusBadge status={c.status} />
                <span className="text-[12px] text-on-surface-variant uppercase font-bold tracking-wider">{c.language}</span>
                <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                  <Icon name="schedule" size="sm" className="text-outline" />
                  {humanizeSchedule(c.schedule)}
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

            {/* Single primary next action — full width on mobile, inline on desktop */}
            <div className="shrink-0 w-full md:w-auto">
              <Button onClick={cta.run} className="w-full md:w-auto">
                <Icon name={cta.icon} size="sm" />
                {cta.label}
              </Button>
            </div>
          </div>
        </div>

        {/* ── B. Status strip: pipeline state · approval · sources · last run ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            icon="schema"
            label="Pipeline"
            value={failedStep ? 'Failed' : isRunning ? 'Running' : c.status === 'draft' ? 'Not started' : 'Complete'}
            tone={failedStep ? 'error' : isRunning ? 'active' : 'neutral'}
          />
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30">
            <p className="text-[11px] uppercase font-bold text-outline tracking-wider mb-1">Approval</p>
            {currentOutputs.length > 0 ? (
              <>
                <p className="text-[15px] font-medium text-on-surface">
                  {approvedCount}/{currentOutputs.length} approved
                  {pending > 0 && <span className="text-on-surface-variant font-normal"> · {pending} pending</span>}
                </p>
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden mt-2">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${(approvedCount / currentOutputs.length) * 100}%` }} />
                </div>
              </>
            ) : (
              <p className="text-[14px] text-on-surface-variant">No outputs yet</p>
            )}
          </div>
          <StatTile
            icon="article"
            label="Sources"
            value={c.sources.length === 0 ? 'None yet' : `${newSources} new${usedSources > 0 ? ` · ${usedSources} used` : ''}`}
            tone={newSources > 0 ? 'active' : 'neutral'}
          />
          <StatTile
            icon="history"
            label="Last run"
            value={c.currentRun?.completedAt ? formatDateTime(c.currentRun.completedAt) : c.currentRun?.startedAt ? 'In progress' : 'Never'}
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
            <span className="text-[13px] font-medium text-on-surface">Case configuration</span>
            <span className="text-[12px] text-on-surface-variant truncate hidden sm:block">
              {GOAL_LABELS[c.contentGoal]} · {STYLE_LABELS[c.contentStyle]} · {c.language === 'en' ? 'English' : 'Hebrew'} · {humanizeSchedule(c.schedule)}
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
                    Writing Style & Goals
                  </h4>
                  <div className="space-y-3">
                    {c.writingStyle && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">Style</p><p className="text-[14px] text-on-surface mt-1">{c.writingStyle}</p></div>}
                    {c.goals && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">Goals</p><p className="text-[14px] text-on-surface mt-1">{c.goals}</p></div>}
                    {c.aiInstructions && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">AI Instructions</p><p className="text-[14px] text-on-surface mt-1 bg-surface-container-low rounded-lg p-3 italic">{c.aiInstructions}</p></div>}
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
              Outputs
            </h4>
            {pending > 0 && (
              <Button size="sm" onClick={() => navigate(`/cases/${c.id}/review`)}>
                <Icon name="rate_review" size="sm" />
                Review Content
              </Button>
            )}
          </div>

          {currentOutputs.length === 0 ? (
            <Card className="p-6">
              <div className="flex flex-col items-center py-4 text-center gap-2">
                <Icon name="pending" size="xl" className="text-outline" />
                <p className="text-[13px] text-on-surface-variant">
                  {c.status === 'draft' ? 'Add sources below, then start the pipeline.' : isRunning ? 'Pipeline is running — outputs will appear here.' : 'No outputs for the current run.'}
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
                    {output.contentScore != null && (
                      <span className="flex items-center gap-1">
                        <Icon name="insights" size="sm" className="text-primary" />
                        Score <span className="font-bold text-on-surface">{output.contentScore}</span>
                      </span>
                    )}
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
            Pipeline Progress
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
                      {stepLabel(step)}
                    </p>
                    {integrity && (
                      <span className={`ml-auto text-[11px] font-bold ${integrity.color}`}>
                        Research Integrity {integrity.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="secondary" size="sm" fullWidth className="mt-4" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
              {c.status === 'draft' ? 'Start Pipeline' : 'View Pipeline'}
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

const RUN_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  running:   { label: 'Running',   cls: 'bg-secondary-container text-on-secondary-container' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
  pending:   { label: 'Pending',   cls: 'bg-surface-container text-on-surface-variant' },
};

function runIntegrityChip(r: RunSummary): { label: string; cls: string } | null {
  if (!r.research) return null;
  switch (r.research.status) {
    case 'success':  return { label: 'Research: High',   cls: 'text-green-700' };
    case 'mock':     return { label: 'Research: Medium', cls: 'text-amber-600' };
    case 'degraded': return { label: 'Research: Low',    cls: 'text-error' };
    default:         return null;
  }
}

function RunHistoryCard({ run, outputs, caseId, onNavigate }: {
  run: RunSummary; outputs: ContentOutput[]; caseId: string; onNavigate: (to: string) => void;
}) {
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
            {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {run.triggeredBy === 'schedule' && (
            <span className="text-[10px] uppercase tracking-wide text-outline shrink-0">scheduled</span>
          )}
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-on-surface-variant mb-2">
        <span className="flex items-center gap-1"><Icon name="article" size="sm" className="text-outline" />{run.sourceCount} source{run.sourceCount !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><Icon name="auto_awesome" size="sm" className="text-outline" />{outputs.length} output{outputs.length !== 1 ? 's' : ''}</span>
        {approved > 0 && <span className="text-green-700 font-medium">{approved} approved</span>}
        {pending > 0 && <span className="text-amber-600 font-medium">{pending} pending</span>}
        {rejected > 0 && <span className="text-error font-medium">{rejected} rejected</span>}
        {integ && <span className={`font-medium ${integ.cls}`}>{integ.label}</span>}
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
            View Review
          </Button>
        )}
        {showPipeline && (
          <Button size="sm" variant="ghost" onClick={() => onNavigate(`/cases/${caseId}/pipeline`)}>
            <Icon name="schema" size="sm" />
            View Pipeline
          </Button>
        )}
      </div>
    </div>
  );
}

function RunHistorySection({ caseId, runs, outputs, onNavigate }: {
  caseId: string; runs: RunSummary[]; outputs: ContentOutput[]; onNavigate: (to: string) => void;
}) {
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
        Run History
        {runs.length > 0 && (
          <span className="text-[12px] font-normal text-outline normal-case tracking-normal">· {runs.length} run{runs.length !== 1 ? 's' : ''}</span>
        )}
      </h4>

      {runs.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center gap-1.5 py-2">
            <Icon name="history" size="xl" className="text-outline" />
            <p className="text-[13px] text-on-surface-variant">No previous runs yet.</p>
            <p className="text-[12px] text-outline">Generations will appear here once the pipeline runs.</p>
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
  const [goal,    setGoal]    = useState<ContentGoal>(c.contentGoal);
  const [style,   setStyle]   = useState<ContentStyle>(c.contentStyle);
  const [lang,    setLang]    = useState<Language>(c.language);
  const [targets, setTargets] = useState<ContentTarget[]>(c.contentTargets);
  const [freq, setFreq] = useState<ScheduleFrequency>(c.schedule.frequency);
  const [time, setTime] = useState<string>(c.schedule.time ?? '09:00');
  const [dow,  setDow]  = useState<number>(c.schedule.dayOfWeek ?? 1);
  const [dom,  setDom]  = useState<number>(c.schedule.dayOfMonth ?? 1);

  function toggleTarget(t: ContentTarget) {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
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
          Case Settings
        </h4>
        {!editing && (
          <button onClick={handleEdit} className="text-[12px] text-primary font-medium flex items-center gap-1 hover:underline">
            <Icon name="edit" size="sm" />Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Goal</p>
              <p className="text-[14px] text-on-surface mt-1">
                {GOAL_LABELS[c.contentGoal]}{c.goalCustom ? ` — ${c.goalCustom}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Style</p>
              <p className="text-[14px] text-on-surface mt-1">
                {STYLE_LABELS[c.contentStyle]}{c.styleCustom ? ` — ${c.styleCustom}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Language</p>
              <p className="text-[14px] text-on-surface mt-1">{c.language === 'en' ? 'English' : 'Hebrew'}</p>
            </div>
            <div>
              <p className="text-[11px] text-outline uppercase font-bold tracking-wider">Schedule</p>
              <p className="text-[14px] text-on-surface mt-1">{humanizeSchedule(c.schedule)}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-outline uppercase font-bold tracking-wider mb-1.5">Content Targets</p>
            <div className="flex flex-wrap gap-1.5">
              {c.contentTargets.length > 0 ? c.contentTargets.map(t => (
                <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[12px] font-medium">
                  <Icon name={TARGET_ICONS[t]} size="sm" />
                  {TARGET_LABELS[t]}
                </span>
              )) : (
                <span className="text-[13px] text-outline">All platforms (legacy)</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Goal select */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">Goal</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(GOAL_LABELS) as [ContentGoal, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setGoal(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium text-left transition-all ${goal===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Style select */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">Content Style</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(STYLE_LABELS) as [ContentStyle, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setStyle(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium text-left transition-all ${style===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Language toggle */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">Language</p>
            <div className="flex gap-2">
              {(['en', 'he'] as Language[]).map(v => (
                <button key={v} type="button" onClick={() => setLang(v)}
                  className={`px-4 py-2 rounded-lg border text-[12px] font-medium transition-all ${lang===v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {v === 'en' ? 'English' : 'Hebrew (עברית)'}
                </button>
              ))}
            </div>
          </div>

          {/* Content Targets */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">Content Targets</p>
            <div className="grid grid-cols-3 gap-1.5">
              {allTargets.map(({ value: t, icon }) => {
                const sel = targets.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTarget(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${sel ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                    <Icon name={icon} size="sm" />
                    {TARGET_LABELS[t]}
                  </button>
                );
              })}
            </div>
            {targets.length === 0 && <p className="text-[11px] text-error mt-1">Select at least one target</p>}
          </div>

          {/* Generate Schedule */}
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">When should content be generated?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FREQ_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setFreq(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${freq === opt.value ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  <Icon name={opt.icon} size="sm" />
                  {opt.label}
                </button>
              ))}
            </div>

            {freq !== 'manual' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {freq === 'weekly' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">Day of week</label>
                    <select value={dow} onChange={e => setDow(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface">
                      {DOW_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                )}
                {freq === 'monthly' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">Day of month</label>
                    <select value={dom} onChange={e => setDom(Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-on-surface-variant">Time</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[12px] text-on-surface" />
                </div>
              </div>
            )}
            {freq === 'manual' && (
              <p className="text-[11px] text-on-surface-variant mt-1.5">Generates only when you click Generate Now.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => onSave({
                contentGoal: goal, contentStyle: style, language: lang, contentTargets: targets,
                scheduleFrequency:  freq,
                scheduleTime:       freq === 'manual' ? null : time,
                scheduleDayOfWeek:  freq === 'weekly'  ? dow : null,
                scheduleDayOfMonth: freq === 'monthly' ? dom : null,
              })}
              loading={saving} disabled={saving || targets.length === 0}>
              <Icon name="save" size="sm" />
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
