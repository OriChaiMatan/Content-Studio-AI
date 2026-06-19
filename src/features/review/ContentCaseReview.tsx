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
  linkedin:   'work',
  facebook:   'groups',
  newsletter: 'email',
  podcast:    'mic',
};

function platformName(p: Platform): string {
  return p.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ── Editorial quality label (action-oriented; numeric score secondary) ────────
function qualityLabel(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Publish Ready',  tone: 'bg-green-100 text-green-700' };
  if (score >= 70) return { label: 'Strong Draft',   tone: 'bg-primary-fixed/60 text-primary' };
  if (score >= 55) return { label: 'Needs Revision', tone: 'bg-amber-100 text-amber-800' };
  return { label: 'Weak Draft', tone: 'bg-red-100 text-red-800' };
}

function QualityChip({ output, size = 'md' }: { output: ContentOutput; size?: 'sm' | 'md' }) {
  const score = output.contentScore;
  if (score == null) return null;
  const q = qualityLabel(score);
  const tp = output.metadata?.thesisPreservation;
  const title = tp
    ? `Thesis Preservation ${tp.score}/100 — presence ${tp.thesisPresence} · spine ${tp.spinePosition} · cross-source ${tp.crossSource} · sharpness ${tp.editorialSharpness} · register ${tp.registerFidelity} · non-flattening ${tp.nonFlattening}`
    : `Quality score ${score}/100`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${q.tone} ${size === 'md' ? 'px-3 py-1 text-[12px]' : 'px-2 py-0.5 text-[10px]'}`}
    >
      {q.label}
      <span className="opacity-60 font-semibold">{score}</span>
    </span>
  );
}

// ── v2 degradation badges (Phase 9 / 10D.0) ───────────────
function isDegraded(output: ContentOutput): boolean {
  const m = output.metadata;
  return !!m && (m.degraded === true ||
    (typeof m.generatorVersion === 'string' && m.generatorVersion.startsWith('mock-fallback')));
}
function isResearchDegraded(output: ContentOutput): boolean {
  return output.metadata?.researchDegraded === true;
}
function DegradedBadge() {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1"
      title="This output was produced by the fallback generator, not the live generator.">
      <Icon name="warning" size="sm" /> Generated with fallback
    </span>
  );
}
function ResearchDegradedBadge() {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-800 flex items-center gap-1"
      title="The research stage fell back to a mock thesis. This content was written from degraded research.">
      <Icon name="warning" size="sm" /> Built on degraded research
    </span>
  );
}

// ── Editorial Breakdown — structured, prominent (Phase 9 v2) ──────────────────
// Maps the platform-specific breakdown keys into labeled editorial sections.
const BREAKDOWN_SECTIONS: { keys: string[]; title: string; icon: string }[] = [
  { keys: ['hook', 'openingHook'],                              title: 'Hook',               icon: 'bolt' },
  { keys: ['subject'],                                          title: 'Subject',            icon: 'subject' },
  { keys: ['previewText'],                                      title: 'Preview',            icon: 'short_text' },
  { keys: ['context', 'background', 'opening', 'story'],        title: 'Context',            icon: 'menu_book' },
  { keys: ['insight', 'mainAnalysis', 'personalInterpretation'], title: 'Core Insight',      icon: 'lightbulb' },
  { keys: ['takeaways', 'practicalTakeaways'],                  title: 'Takeaways',          icon: 'checklist' },
  { keys: ['communityQuestion'],                                title: 'Community Question', icon: 'forum' },
  { keys: ['closingInsight', 'closingThoughts'],               title: 'Closing',            icon: 'flag' },
  { keys: ['cta'],                                              title: 'Call to Action',     icon: 'campaign' },
  { keys: ['hashtags'],                                         title: 'Hashtags',           icon: 'tag' },
];

function SectionValue({ title, value }: { title: string; value: unknown }) {
  if (value == null || value === '') return null;
  if (title === 'Hashtags' && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((t, i) => (
          <span key={i} className="text-[12px] text-primary bg-primary-fixed/40 px-2 py-0.5 rounded-full font-medium">
            {String(t).startsWith('#') ? String(t) : `#${t}`}
          </span>
        ))}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1.5">
        {value.map((v, i) => (
          <li key={i} className="flex gap-2 text-[14px] text-on-surface leading-relaxed" dir="auto">
            <Icon name="arrow_right" size="sm" className="text-primary shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap text-start">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap text-start" dir="auto">
      {String(value)}
    </p>
  );
}

function EditorialBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const used = new Set<string>();
  const sections = BREAKDOWN_SECTIONS.map(sec => {
    const key = sec.keys.find(k => k in breakdown && breakdown[k] != null && breakdown[k] !== '');
    if (!key) return null;
    used.add(key);
    return { ...sec, value: breakdown[key] };
  }).filter(Boolean) as { title: string; icon: string; value: unknown }[];

  // Anything not mapped above (e.g. fullScript on legacy podcast) — quietly skipped
  // from the structured view to keep the editorial breakdown focused.
  if (sections.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
      <div className="px-5 py-3 border-b border-outline-variant/30 bg-surface-container-low/60 flex items-center gap-2">
        <Icon name="architecture" size="sm" className="text-primary" />
        <h4 className="text-[13px] font-bold uppercase tracking-wider text-on-surface">Editorial Breakdown</h4>
        <span className="text-[11px] text-on-surface-variant">· how this draft is built</span>
      </div>
      <div className="divide-y divide-outline-variant/20">
        {sections.map((sec, i) => (
          <div key={i} className="px-5 py-3.5 grid grid-cols-[140px_1fr] gap-4">
            <div className="flex items-start gap-2 text-on-surface-variant">
              <Icon name={sec.icon} size="sm" className="text-primary mt-0.5" />
              <span className="text-[12px] font-bold uppercase tracking-wider">{sec.title}</span>
            </div>
            <div><SectionValue title={sec.title} value={sec.value} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Draft pane — the active output (reading + decision surface) ───────────────
function DraftPane({ output, caseId }: { output: ContentOutput; caseId: string }) {
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

  // Read status DIRECTLY from the store so Approve/Reject reflect instantly (the
  // page renders from useLiveCase's local poll state otherwise). The `output` prop
  // still drives body/breakdown/scores (which don't change on approve/reject).
  const liveStatus = useContentCasesStore(s => s.getCaseById(caseId)?.outputs.find(o => o.id === output.id)?.status);
  const status = liveStatus ?? output.status;

  useEffect(() => { setBody(output.body); setEditing(false); }, [output.body, output.id]);

  async function handleApprove() {
    if (approving || status === 'approved') return;
    const prev = status;
    setApproving(true); setActionError(null);
    setOutputStatusLocal(caseId, output.id, 'approved');
    try {
      await updateOutputStatus(caseId, output.id, 'approved');
      void refreshCase(caseId);
      void fetchLibrary();
    } catch (err) {
      setOutputStatusLocal(caseId, output.id, prev);
      setActionError(err instanceof Error ? err.message : 'Unable to approve. Please try again.');
    } finally { setApproving(false); }
  }

  async function handleReject() {
    if (rejecting || status === 'rejected') return;
    const prev = status;
    setRejecting(true); setActionError(null);
    setOutputStatusLocal(caseId, output.id, 'rejected');
    try {
      await updateOutputStatus(caseId, output.id, 'rejected');
    } catch (err) {
      setOutputStatusLocal(caseId, output.id, prev);
      setActionError(err instanceof Error ? err.message : 'Unable to reject. Please try again.');
    } finally { setRejecting(false); }
  }

  async function handleSaveEdit() {
    if (saving) return;
    setSaving(true); setActionError(null);
    try {
      await updateOutputBody(caseId, output.id, body);
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save. Please try again.');
    } finally { setSaving(false); }
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true); setActionError(null);
    try {
      await regenerateOutput(caseId, output.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to regenerate. Please try again.');
    } finally { setRegenerating(false); }
  }

  const busy = approving || rejecting || saving || regenerating;
  const hasBreakdown = !!output.breakdown && Object.keys(output.breakdown).length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[72ch] mx-auto space-y-6">

          {/* Draft header */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <PlatformBadge platform={output.platform} />
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isResearchDegraded(output) && <ResearchDegradedBadge />}
                {isDegraded(output) && <DegradedBadge />}
                <QualityChip output={output} />
                <OutputStatusBadge status={status} />
              </div>
            </div>
            <h1 className="text-[26px] font-serif text-on-surface leading-tight" dir="auto">{output.title}</h1>
            {(output.researchConfidence != null || output.factCheckAccuracy != null) && (
              <p className="text-[12px] text-on-surface-variant mt-2 flex items-center gap-3">
                {output.researchConfidence != null && <span>Research {output.researchConfidence}%</span>}
                {output.factCheckAccuracy != null && <span>· Fact-check {output.factCheckAccuracy}%</span>}
              </p>
            )}
          </div>

          {/* Draft body — reads like content, not raw output */}
          {editing ? (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={18}
              dir="auto"
              style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
              className="w-full bg-surface-container-low border border-primary rounded-xl text-[15px] leading-relaxed text-on-surface px-4 py-3 font-sans resize-y focus:ring-2 focus:ring-primary"
            />
          ) : (
            <article className="border-t border-outline-variant/30 pt-5">
              {output.body.split(/\n{2,}/).map((para, i) => (
                <p key={i} dir="auto" className="text-[15.5px] leading-[1.8] text-on-surface mb-4 whitespace-pre-wrap text-start">
                  {para}
                </p>
              ))}
            </article>
          )}

          {/* Editorial Breakdown — prominent structured panel */}
          {!editing && hasBreakdown && <EditorialBreakdown breakdown={output.breakdown!} />}
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="mx-8 mb-2 flex items-center gap-2 bg-error-container/50 border border-error/20 rounded-lg px-3 py-2">
          <Icon name="error" size="sm" className="text-error shrink-0" />
          <p className="text-[12px] text-on-error-container">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-outline hover:text-on-surface">
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* Decision bar — Approve is the dominant action when pending */}
      <div className="border-t border-outline-variant bg-surface px-8 py-4 flex items-center gap-3 flex-wrap">
        {editing ? (
          <>
            <Button onClick={handleSaveEdit} loading={saving} disabled={busy}>
              <Icon name="save" size="sm" />
              {saving ? 'Saving…' : 'Save Edit'}
            </Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setBody(output.body); }} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={status === 'approved' || busy}>
              <Icon name="edit" size="sm" />
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={handleRegenerate} loading={regenerating} disabled={busy}>
              <Icon name="refresh" size="sm" />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <div className="flex-1" />
            {status === 'approved' && (
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-green-700">
                <Icon name="check_circle" size="sm" /> Approved
              </span>
            )}
            {status !== 'rejected' && (
              <Button size="sm" variant="danger" onClick={handleReject} loading={rejecting} disabled={busy}>
                <Icon name="cancel" size="sm" />
                {rejecting ? 'Rejecting…' : 'Reject'}
              </Button>
            )}
            {status !== 'approved' && (
              <Button onClick={handleApprove} loading={approving} disabled={busy} className="px-6">
                <Icon name="check_circle" size="sm" />
                {approving ? 'Approving…' : 'Approve'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function ContentCaseReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runIdParam = searchParams.get('runId');

  const caseItem = useLiveCase(id);
  const loading  = useContentCasesStore(s => s.loading);
  const liveOutputs = useContentCasesStore(s => s.getCaseById(id ?? '')?.outputs);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');

  if (!caseItem) {
    return (
      <>
        <TopBar title="Review" />
        <main className="flex-1 flex items-center justify-center p-8">
          {loading
            ? <div className="flex items-center gap-3 text-on-surface-variant"><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">Loading…</span></div>
            : <div className="flex flex-col items-center text-center gap-4">
                <Icon name="search_off" size="xl" className="text-outline" />
                <p className="text-[15px] text-on-surface-variant">Case not found.</p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}><Icon name="arrow_back" size="sm" />Back to Cases</Button>
              </div>}
        </main>
      </>
    );
  }

  const c = caseItem;

  const targetRunId  = runIdParam ?? c.currentRun?.id ?? null;
  const isHistorical = runIdParam !== null && runIdParam !== c.currentRun?.id;

  const reviewOutputs = targetRunId
    ? c.outputs.filter(o => o.pipelineRunId === targetRunId)
    : c.outputs;

  const statusOf = (o: ContentOutput) => liveOutputs?.find(x => x.id === o.id)?.status ?? o.status;
  const approvedCount = reviewOutputs.filter(o => statusOf(o) === 'approved').length;
  const totalCount    = reviewOutputs.length;
  const allReviewed   = totalCount > 0 && reviewOutputs.every(o => statusOf(o) !== 'draft');

  const sortedOutputs = [...reviewOutputs].sort((a, b) =>
    PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );

  const resolvedPlatform: Platform = sortedOutputs.find(o => o.platform === activePlatform)
    ? activePlatform
    : (sortedOutputs[0]?.platform ?? 'linkedin');
  const activeOutput = sortedOutputs.find(o => o.platform === resolvedPlatform) ?? sortedOutputs[0];

  // Run context for the header (thesis/integrity available for the current run).
  const thesis      = !isHistorical ? (c.currentRun?.thesis ?? null) : null;
  const integrity   = !isHistorical ? (c.currentRun?.research ?? null) : null;
  const generatedAt = (!isHistorical && c.currentRun?.completedAt) || sortedOutputs[0]?.generatedAt || null;
  const sourceCount = c.currentRun?.sourceCount ?? c.sources.length;

  const integrityChip = integrity && (
    integrity.status === 'success'
      ? { label: 'Real research', tone: 'text-green-700', icon: 'verified' }
      : integrity.status === 'degraded'
        ? { label: 'Degraded research', tone: 'text-red-700', icon: 'warning' }
        : { label: 'Mock research', tone: 'text-amber-700', icon: 'science' }
  );

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
        {/* Historical-run banner */}
        {isHistorical && (
          <div className="px-8 py-2.5 bg-secondary-container/40 border-b border-outline-variant flex items-center gap-3 text-[13px] text-on-secondary-container">
            <Icon name="history" size="sm" />
            <span>Viewing outputs from a previous run.{' '}
              <button onClick={() => navigate(`/cases/${c.id}/review`)} className="font-bold underline hover:no-underline">Switch to current run</button>
            </span>
          </div>
        )}

        {/* ── Rich review header ─────────────────────────────── */}
        <div className="px-8 py-5 bg-surface-container-low border-b border-outline-variant">
          <div className="flex items-center gap-3 flex-wrap text-[12px] text-on-surface-variant mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-on-surface">
              <Icon name={isHistorical ? 'history' : 'bolt'} size="sm" className="text-primary" />
              {isHistorical ? 'Historical run' : 'Current run'}
            </span>
            {generatedAt && (
              <span className="inline-flex items-center gap-1">
                <Icon name="schedule" size="sm" className="text-outline" />
                Generated {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date(generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="article" size="sm" className="text-outline" />
              {sourceCount} source{sourceCount !== 1 ? 's' : ''}
            </span>
            {integrityChip && (
              <span className={`inline-flex items-center gap-1 font-medium ${integrityChip.tone}`}>
                <Icon name={integrityChip.icon} size="sm" />
                {integrityChip.label}
              </span>
            )}
          </div>

          {/* Thesis — the editorial spine */}
          {thesis ? (
            <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 px-4 py-3">
              <Icon name="format_quote" className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Core thesis</p>
                <p className="text-[15px] font-serif text-on-surface leading-snug" dir="auto">{thesis}</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-variant italic">No synthesized thesis available for this run.</p>
          )}
        </div>

        {/* ── Two-column workspace ───────────────────────────── */}
        {reviewOutputs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <Icon name="auto_awesome" size="xl" className="text-outline mb-4" />
            <p className="text-[16px] font-medium text-on-surface-variant">
              {isHistorical ? 'No outputs found for this run.' : 'No outputs generated yet.'}
            </p>
            <p className="text-[14px] text-outline mt-1">
              {isHistorical ? 'This run may have been cleared or its outputs are unavailable.' : 'Run the pipeline first to generate content.'}
            </p>
            {!isHistorical && (
              <Button className="mt-6" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>Go to Pipeline</Button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">

            {/* Left rail — progress + output navigation */}
            <aside className="hidden md:flex md:flex-col w-72 shrink-0 border-r border-outline-variant bg-surface-container-low/40 overflow-y-auto">
              <div className="p-5 border-b border-outline-variant/40">
                <div className="flex items-center justify-between text-[12px] text-on-surface-variant mb-1.5">
                  <span>Review progress</span>
                  <span className="font-bold text-on-surface">{approvedCount}/{totalCount}</span>
                </div>
                <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all rounded-full" style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }} />
                </div>
                {allReviewed && (
                  <div className="mt-3 flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-[12px] font-bold">
                    <Icon name="celebration" size="sm" /> All outputs reviewed
                  </div>
                )}
              </div>
              <nav className="p-3 space-y-1">
                {sortedOutputs.map(output => {
                  const st = statusOf(output);
                  const active = output.platform === resolvedPlatform;
                  const q = output.contentScore != null ? qualityLabel(output.contentScore) : null;
                  return (
                    <button
                      key={output.id}
                      onClick={() => setActivePlatform(output.platform)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-container'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={platformIcon[output.platform]} size="sm" />
                        <span className="text-[13px] font-medium flex-1">{platformName(output.platform)}</span>
                        {st === 'approved' && <Icon name="check_circle" size="sm" className="text-green-600" />}
                        {st === 'rejected' && <Icon name="cancel" size="sm" className="text-error" />}
                        {st === 'draft' && <span className="w-2 h-2 rounded-full bg-amber-400" title="Pending review" />}
                      </div>
                      {q && (
                        <p className="text-[11px] mt-0.5 ms-6 opacity-80">{q.label} · {output.contentScore}</p>
                      )}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main draft pane */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile tab bar */}
              <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b border-outline-variant bg-surface">
                {sortedOutputs.map(output => (
                  <button
                    key={output.id}
                    onClick={() => setActivePlatform(output.platform)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${output.platform === resolvedPlatform ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    <Icon name={platformIcon[output.platform]} size="sm" />
                    {platformName(output.platform)}
                    {statusOf(output) === 'approved' && <Icon name="check_circle" size="sm" className="text-green-600" />}
                  </button>
                ))}
              </div>

              {activeOutput && <DraftPane key={activeOutput.id} output={activeOutput} caseId={c.id} />}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
