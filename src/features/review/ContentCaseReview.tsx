import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useLiveCase } from '../content-cases/useLiveCase';
import type { Platform, ContentOutput } from '../../types';

const PLATFORM_ORDER: Platform[] = ['linkedin', 'facebook', 'newsletter', 'podcast'];

const platformIcon: Record<Platform, string> = {
  linkedin:     'work',
  facebook:     'groups',
  newsletter:   'email',
  podcast:      'mic',
};

// ── Score pill ────────────────────────────────────────────

function ScorePill({ label, value, icon }: { label: string; value: number; icon: string }) {
  const color = value >= 90 ? 'text-green-700 bg-green-100' : value >= 75 ? 'text-primary bg-primary-fixed/50' : 'text-outline bg-surface-container';
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${color}`}>
      <Icon name={icon} size="sm" />
      <span>{label}: {value}%</span>
    </div>
  );
}

// ── Output card ───────────────────────────────────────────

// ── v2 helpers (Phase 9) ──────────────────────────────────
function isDegraded(output: ContentOutput): boolean {
  const m = output.metadata;
  return !!m && (m.degraded === true ||
    (typeof m.generatorVersion === 'string' && m.generatorVersion.startsWith('mock-fallback')));
}

// Phase 10D.0 — the generator may have succeeded (claude-gen-1) while the RESEARCH
// it was built on degraded to mock. That must be visible too, distinctly.
function isResearchDegraded(output: ContentOutput): boolean {
  return output.metadata?.researchDegraded === true;
}

function DegradedBadge() {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1"
      title="This output was produced by the fallback generator, not the live generator."
    >
      <Icon name="warning" size="sm" /> Generated with fallback
    </span>
  );
}

function ResearchDegradedBadge() {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-800 flex items-center gap-1"
      title="The research stage fell back to a mock thesis. This content was written from degraded research — the thesis competition did not run."
    >
      <Icon name="warning" size="sm" /> Built on degraded research
    </span>
  );
}

// Phase 10E.2 — how much of the winning thesis survived into this content.
function ThesisPreservationBadge({ output }: { output: ContentOutput }) {
  const tp = output.metadata?.thesisPreservation;
  if (!tp) return null;
  const tone = tp.score >= 75 ? 'bg-green-100 text-green-700'
    : tp.score >= 55 ? 'bg-amber-100 text-amber-800'
    : 'bg-red-100 text-red-800';
  const title =
    `Thesis Preservation ${tp.score}/100 — how much of the winning thesis survived into this content.\n` +
    `presence ${tp.thesisPresence} · spine ${tp.spinePosition} · cross-source ${tp.crossSource} · ` +
    `sharpness ${tp.editorialSharpness} · register ${tp.registerFidelity} · non-flattening ${tp.nonFlattening}`;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tone} flex items-center gap-1`} title={title}>
      TPS {tp.score}
    </span>
  );
}

function humanizeKey(k: string): string {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

// Generic, read-only renderer for the platform-specific breakdown.
function BreakdownValue({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value === 'string') {
    return <span dir="auto" className="text-[12px] text-on-surface-variant whitespace-pre-wrap text-start">{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-[12px] text-on-surface-variant">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc ms-5 space-y-0.5">
        {value.map((v, i) => <li key={i}><BreakdownValue value={v} /></li>)}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <div className="ms-2 space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}><span className="text-[11px] font-medium text-outline">{humanizeKey(k)}: </span><BreakdownValue value={v} /></div>
        ))}
      </div>
    );
  }
  return null;
}

function BreakdownView({ breakdown }: { breakdown: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(breakdown).map(([k, v]) => (
        <div key={k}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline mb-0.5">{humanizeKey(k)}</p>
          <BreakdownValue value={v} />
        </div>
      ))}
    </div>
  );
}

interface OutputCardProps {
  output: ContentOutput;
  caseId: string;
  isActive: boolean;
  onSelect: () => void;
}

function OutputCard({ output, caseId, isActive, onSelect }: OutputCardProps) {
  const [editing, setEditing]   = useState(false);
  const [body, setBody]         = useState(output.body);
  const [approving, setApproving]       = useState(false);
  const [rejecting, setRejecting]       = useState(false);
  const [saving,    setSaving]          = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  const updateOutputStatus   = useContentCasesStore(s => s.updateOutputStatus);
  const setOutputStatusLocal = useContentCasesStore(s => s.setOutputStatusLocal);
  const updateOutputBody     = useContentCasesStore(s => s.updateOutputBody);
  const regenerateOutput     = useContentCasesStore(s => s.regenerateOutput);
  const refreshCase          = useContentCasesStore(s => s.refreshCase);
  const fetchLibrary         = useLibraryStore(s => s.fetchLibrary);

  // The page renders outputs from useLiveCase's LOCAL state, which only refreshes on the
  // 5s poll — so optimistic STORE updates were invisible (the real bug). Subscribe to the
  // status DIRECTLY from the store so Approve/Reject reflect instantly; the `output` prop
  // still drives body/breakdown/scores (which don't change on approve/reject).
  const liveStatus = useContentCasesStore(s => s.getCaseById(caseId)?.outputs.find(o => o.id === output.id)?.status);
  const status = liveStatus ?? output.status;

  // Keep local edit state in sync when the store updates (e.g. after Regenerate)
  useEffect(() => {
    setBody(output.body);
    setEditing(false);
  }, [output.body]);

  async function handleApprove() {
    if (approving || status === 'approved') return;
    const prev = status;
    setApproving(true);
    setActionError(null);
    setOutputStatusLocal(caseId, output.id, 'approved');   // optimistic — instant
    try {
      await updateOutputStatus(caseId, output.id, 'approved');
      // Background — do NOT block the button on these (approval updates sources + library).
      void refreshCase(caseId);
      void fetchLibrary();
    } catch (err) {
      setOutputStatusLocal(caseId, output.id, prev);        // rollback
      setActionError(err instanceof Error ? err.message : 'Unable to approve. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (rejecting || status === 'rejected') return;
    const prev = status;
    setRejecting(true);
    setActionError(null);
    setOutputStatusLocal(caseId, output.id, 'rejected');   // optimistic — instant
    try {
      await updateOutputStatus(caseId, output.id, 'rejected');
    } catch (err) {
      setOutputStatusLocal(caseId, output.id, prev);        // rollback
      setActionError(err instanceof Error ? err.message : 'Unable to reject. Please try again.');
    } finally {
      setRejecting(false);
    }
  }

  async function handleSaveEdit() {
    if (saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await updateOutputBody(caseId, output.id, body);
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await regenerateOutput(caseId, output.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to regenerate. Please try again.');
    } finally {
      setRegenerating(false);
    }
  }

  const statusBorderColor = {
    draft:    'border-l-outline-variant',
    approved: 'border-l-green-400',
    rejected: 'border-l-error',
  }[status];

  const busy = approving || rejecting || saving || regenerating;

  return (
    <div
      className={`rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm border-l-4 ${statusBorderColor} cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-outline">
            <Icon name={platformIcon[output.platform]} size="sm" />
          </div>
          <PlatformBadge platform={output.platform} />
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isResearchDegraded(output) && <ResearchDegradedBadge />}
          {isDegraded(output) && <DegradedBadge />}
          <ThesisPreservationBadge output={output} />
          <OutputStatusBadge status={status} />
        </div>
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <h3 className="text-[15px] font-medium text-on-surface" dir="auto">{output.title}</h3>
      </div>

      {/* Scores */}
      {output.contentScore !== null && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          <ScorePill label="Quality (TPS)" value={output.contentScore!}      icon="star" />
          <ScorePill label="Research conf." value={output.researchConfidence!} icon="search" />
          <ScorePill label="Fact Check conf." value={output.factCheckAccuracy!} icon="fact_check" />
        </div>
      )}

      {/* Ready To Publish — the ONLY editable field (= body). RTL/LTR auto. */}
      <div className="px-5 pb-4">
        {isActive && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline mb-1">Ready To Publish</p>
        )}
        {isActive ? (
          editing ? (
            <div onClick={e => e.stopPropagation()}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={12}
                dir="auto"
                style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
                className="w-full bg-surface-container-low border border-primary rounded-lg text-[13px] text-on-surface px-3 py-2 font-sans resize-y focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : (
            <pre dir="auto" className="whitespace-pre-wrap text-[13px] text-on-surface font-sans leading-relaxed max-h-64 overflow-y-auto text-start">
              {output.body}
            </pre>
          )
        ) : (
          <p dir="auto" className="text-[13px] text-on-surface-variant line-clamp-3 text-start">{output.body}</p>
        )}
      </div>

      {/* Breakdown — read-only, platform-specific (Phase 9 v2). Hidden on legacy
          v1 outputs (breakdown=null) and only expanded for the active card. */}
      {isActive && !editing && output.breakdown && Object.keys(output.breakdown).length > 0 && (
        <div className="px-5 pb-4" onClick={e => e.stopPropagation()}>
          <details className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40">
            <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-outline">
              Breakdown <span className="font-normal normal-case text-on-surface-variant/70">(read-only)</span>
            </summary>
            <div className="px-3 pb-3 pt-1 max-h-80 overflow-y-auto">
              <BreakdownView breakdown={output.breakdown} />
            </div>
          </details>
        </div>
      )}

      {/* Action error banner */}
      {isActive && actionError && (
        <div className="mx-5 mb-2 flex items-center gap-2 bg-error-container/50 border border-error/20 rounded-lg px-3 py-2">
          <Icon name="error" size="sm" className="text-error shrink-0" />
          <p className="text-[12px] text-on-error-container">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-outline hover:text-on-surface">
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* Actions — only on active card */}
      {isActive && (
        <div
          className="border-t border-outline-variant/30 px-5 py-3 flex gap-2 flex-wrap"
          onClick={e => e.stopPropagation()}
        >
          {editing ? (
            <>
              <Button size="sm" onClick={handleSaveEdit} loading={saving} disabled={busy}>
                <Icon name="save" size="sm" />
                {saving ? 'Saving…' : 'Save Edit'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(output.body); }} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline"
                onClick={() => setEditing(true)}
                disabled={status === 'approved' || busy}
              >
                <Icon name="edit" size="sm" />
                Edit
              </Button>
              <Button size="sm" variant="outline"
                onClick={handleRegenerate}
                loading={regenerating}
                disabled={busy}
              >
                <Icon name="refresh" size="sm" />
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </Button>
              <div className="flex-1" />
              {status !== 'rejected' && (
                <Button size="sm" variant="danger"
                  onClick={handleReject}
                  loading={rejecting}
                  disabled={busy}
                >
                  <Icon name="cancel" size="sm" />
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </Button>
              )}
              {status !== 'approved' && (
                <Button size="sm"
                  onClick={handleApprove}
                  loading={approving}
                  disabled={busy}
                >
                  <Icon name="check_circle" size="sm" />
                  {approving ? 'Approving…' : 'Approve'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function ContentCaseReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Optional ?runId= param: if provided, show only that run's outputs.
  // Used when navigating from the Library to view a specific historical run.
  const runIdParam = searchParams.get('runId');

  // Live, auto-refreshing case (same pattern as the detail/pipeline pages): polls
  // GET /cases/:id immediately on mount and every 5s into local state. This fixes the
  // regression where the review page read a stale store snapshot (no outputs) when the
  // case was already loaded, so a just-completed run showed "No outputs generated yet"
  // until a manual refresh. The unconditional mount fetch also covers the historical
  // ?runId= case (previously a conditional refresh).
  const caseItem = useLiveCase(id);
  const loading  = useContentCasesStore(s => s.loading);
  // Live status from the STORE (not the useLiveCase poll) so the tab icons + approved
  // count reflect optimistic approve/reject instantly, like the card itself.
  const liveOutputs = useContentCasesStore(s => s.getCaseById(id ?? '')?.outputs);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');

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

  // Determine which run to display:
  //   • ?runId= query param (from Library "Open Review" link) → show that specific run
  //   • Otherwise → show the most recent (current) run
  const targetRunId  = runIdParam ?? c.currentRun?.id ?? null;
  const isHistorical = runIdParam !== null && runIdParam !== c.currentRun?.id;

  const reviewOutputs = targetRunId
    ? c.outputs.filter(o => o.pipelineRunId === targetRunId)
    : c.outputs;

  const statusOf = (o: ContentOutput) => liveOutputs?.find(x => x.id === o.id)?.status ?? o.status;
  const approvedCount = reviewOutputs.filter(o => statusOf(o) === 'approved').length;
  const totalCount    = reviewOutputs.length;

  const sortedOutputs = [...reviewOutputs].sort((a, b) =>
    PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );

  // Ensure activePlatform always resolves to an existing output
  const resolvedPlatform: Platform = sortedOutputs.find(o => o.platform === activePlatform)
    ? activePlatform
    : (sortedOutputs[0]?.platform ?? 'linkedin');

  const activeOutput = sortedOutputs.find(o => o.platform === resolvedPlatform) ?? sortedOutputs[0];

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex items-center gap-3">
            <CaseStatusBadge status={c.status} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>
              <Icon name="arrow_back" size="sm" />
              Case
            </Button>
          </div>
        }
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Historical run banner */}
        {isHistorical && (
          <div className="px-8 py-2.5 bg-secondary-container/40 border-b border-outline-variant flex items-center gap-3 text-[13px] text-on-secondary-container">
            <Icon name="history" size="sm" />
            <span>Viewing outputs from a previous run.{' '}
              <button
                onClick={() => navigate(`/cases/${c.id}/review`)}
                className="font-bold underline hover:no-underline"
              >
                Switch to current run
              </button>
            </span>
          </div>
        )}

        {/* Progress + source context */}
        <div className="px-8 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-[13px] text-on-surface-variant mb-1.5">
              <span>Review Progress</span>
              <span className="font-bold text-on-surface">{approvedCount} / {totalCount} approved</span>
            </div>
            <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all rounded-full"
                style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
          {c.sources.length > 0 && (
            <div className="flex items-center gap-2 text-[12px] text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/30">
              <Icon name="article" size="sm" className="text-outline" />
              <span>Generated from <span className="font-bold text-on-surface">{c.sources.length}</span> source{c.sources.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {approvedCount === totalCount && totalCount > 0 && (
            <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-xl">
              <Icon name="celebration" size="sm" />
              <span className="text-[13px] font-bold">All outputs reviewed!</span>
            </div>
          )}
        </div>

        {/* Platform tab bar */}
        <div className="px-8 py-3 border-b border-outline-variant bg-surface flex gap-2 overflow-x-auto">
          {sortedOutputs.map(output => (
            <button
              key={output.id}
              onClick={() => setActivePlatform(output.platform)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all',
                resolvedPlatform === output.platform
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container',
              ].join(' ')}
            >
              <Icon name={platformIcon[output.platform]} size="sm" />
              {output.platform.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {statusOf(output) === 'approved' && <Icon name="check_circle" size="sm" className="text-green-600" />}
              {statusOf(output) === 'rejected' && <Icon name="cancel" size="sm" className="text-error" />}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-8">
          {reviewOutputs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Icon name="auto_awesome" size="xl" className="text-outline mb-4" />
              <p className="text-[16px] font-medium text-on-surface-variant">
                {isHistorical ? 'No outputs found for this run.' : 'No outputs generated yet.'}
              </p>
              <p className="text-[14px] text-outline mt-1">
                {isHistorical
                  ? 'This run may have been cleared or its outputs are unavailable.'
                  : 'Run the pipeline first to generate content.'}
              </p>
              {!isHistorical && (
                <Button className="mt-6" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
                  Go to Pipeline
                </Button>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {activeOutput && (
                <OutputCard
                  key={activeOutput.id}
                  output={activeOutput}
                  caseId={c.id}
                  isActive
                  onSelect={() => {}}
                />
              )}
              {sortedOutputs.filter(o => o.platform !== resolvedPlatform).length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-outline mb-3">Other Outputs</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sortedOutputs
                      .filter(o => o.platform !== resolvedPlatform)
                      .map(output => (
                        <OutputCard
                          key={output.id}
                          output={output}
                          caseId={c.id}
                          isActive={false}
                          onSelect={() => setActivePlatform(output.platform)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
