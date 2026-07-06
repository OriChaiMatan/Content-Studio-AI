import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useLiveCase } from '../content-cases/useLiveCase';
import { VisualPanel } from './VisualPanel';
import { useVisual } from './useVisual';
import { PodcastPanel } from '../podcast/PodcastPanel';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import type { Platform, ContentOutput } from '../../types';

type ActiveTab = Platform | 'podcast_engine';

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
  const { t } = useT();
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1"
      title={t('review.degradedBadgeTitle')}>
      <Icon name="warning" size="sm" /> {t('review.degradedBadge')}
    </span>
  );
}
function ResearchDegradedBadge() {
  const { t } = useT();
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-800 flex items-center gap-1"
      title={t('review.researchDegradedBadgeTitle')}>
      <Icon name="warning" size="sm" /> {t('review.researchDegradedBadge')}
    </span>
  );
}

// ── Editorial Breakdown — structured, prominent (Phase 9 v2) ──────────────────
// Maps the platform-specific breakdown keys into labeled editorial sections.
const BREAKDOWN_SECTIONS: { keys: string[]; titleKey: StringKey; icon: string }[] = [
  { keys: ['hook', 'openingHook'],                              titleKey: 'review.section.hook',             icon: 'bolt' },
  { keys: ['subject'],                                          titleKey: 'review.section.subject',          icon: 'subject' },
  { keys: ['previewText'],                                      titleKey: 'review.section.preview',          icon: 'short_text' },
  { keys: ['context', 'background', 'opening', 'story'],        titleKey: 'review.section.context',          icon: 'menu_book' },
  { keys: ['insight', 'mainAnalysis', 'personalInterpretation'], titleKey: 'review.section.coreInsight',     icon: 'lightbulb' },
  { keys: ['takeaways', 'practicalTakeaways'],                  titleKey: 'review.section.takeaways',        icon: 'checklist' },
  { keys: ['communityQuestion'],                                titleKey: 'review.section.communityQuestion', icon: 'forum' },
  { keys: ['closingInsight', 'closingThoughts'],               titleKey: 'review.section.closing',          icon: 'flag' },
  { keys: ['cta'],                                              titleKey: 'review.section.cta',              icon: 'campaign' },
  { keys: ['hashtags'],                                         titleKey: 'review.section.hashtags',         icon: 'tag' },
];

function SectionValue({ titleKey, value }: { titleKey: StringKey; value: unknown }) {
  if (value == null || value === '') return null;
  if (titleKey === 'review.section.hashtags' && Array.isArray(value)) {
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
            <span style={{ unicodeBidi: 'plaintext' }} className="whitespace-pre-wrap text-start">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap text-start" dir="auto" style={{ unicodeBidi: 'plaintext' }}>
      {String(value)}
    </p>
  );
}

function EditorialBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const { t } = useT();
  const used = new Set<string>();
  const sections = BREAKDOWN_SECTIONS.map(sec => {
    const key = sec.keys.find(k => k in breakdown && breakdown[k] != null && breakdown[k] !== '');
    if (!key) return null;
    used.add(key);
    return { ...sec, value: breakdown[key] };
  }).filter(Boolean) as { titleKey: StringKey; icon: string; value: unknown }[];

  // Anything not mapped above (e.g. fullScript on legacy podcast) — quietly skipped
  // from the structured view to keep the editorial breakdown focused.
  if (sections.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
      <div className="px-5 py-3 border-b border-outline-variant/30 bg-surface-container-low/60 flex items-center gap-2">
        <Icon name="architecture" size="sm" className="text-primary" />
        <h4 className="text-[13px] font-bold uppercase tracking-wider text-on-surface">{t('review.editorialBreakdown')}</h4>
        <span className="text-[11px] text-on-surface-variant">{t('review.breakdownSubtitle')}</span>
      </div>
      <div className="divide-y divide-outline-variant/20">
        {sections.map((sec, i) => (
          <div key={i} className="px-5 py-3.5 grid grid-cols-[140px_1fr] gap-4">
            <div className="flex items-start gap-2 text-on-surface-variant">
              <Icon name={sec.icon} size="sm" className="text-primary mt-0.5" />
              <span className="text-[12px] font-bold uppercase tracking-wider">{t(sec.titleKey)}</span>
            </div>
            <div><SectionValue titleKey={sec.titleKey} value={sec.value} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Draft pane — the active output (reading + decision surface) ───────────────
function DraftPane({ output, caseId }: { output: ContentOutput; caseId: string }) {
  const { t } = useT();
  const [editing, setEditing]   = useState(false);
  const [body, setBody]         = useState(output.body);
  const [approving, setApproving]       = useState(false);
  const [rejecting, setRejecting]       = useState(false);
  const [saving,    setSaving]          = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [copyState,  setCopyState]  = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied' | 'error'>('idle');
  const [showBreakdown, setShowBreakdown] = useState(false); // editorial breakdown collapsed by default

  // Visual Engine state (shared by the header button + the Visual section). LinkedIn/Facebook only.
  const visualPlatform = output.platform === 'linkedin' || output.platform === 'facebook' ? output.platform : null;
  const visual = useVisual(caseId, output.id, visualPlatform);
  const visualRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Prefetch the ready visual PNG into a ref so Share can call navigator.share()
  // synchronously (preserving the iOS user-activation gesture). Cleared when the
  // visual isn't ready or its URL changes.
  const visualFileRef = useRef<File | null>(null);
  const visualFinalUrl = visual.isReady ? visual.asset.finalUrl ?? null : null;
  useEffect(() => {
    visualFileRef.current = null;
    if (!visualFinalUrl || !visualPlatform) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(visualFinalUrl, { credentials: 'include' });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        visualFileRef.current = new File([blob], `lumai-${visualPlatform}.png`, { type: 'image/png' });
      } catch { /* leave null → Share falls back to text-only */ }
    })();
    return () => { cancelled = true; };
  }, [visualFinalUrl, visualPlatform]);

  // Header/menu "Visual" is NAVIGATION — smooth-scroll to the section; generation
  // happens only from the large card CTA.
  function scrollToVisual() {
    visualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Close the mobile actions menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

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

  useEffect(() => {
    setBody(output.body); setEditing(false);
    setCopyState('idle'); setShareState('idle');
  }, [output.body, output.id]);

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
      setActionError(err instanceof Error ? err.message : t('review.errApprove'));
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
      setActionError(err instanceof Error ? err.message : t('review.errReject'));
    } finally { setRejecting(false); }
  }

  async function handleSaveEdit() {
    if (saving) return;
    setSaving(true); setActionError(null);
    try {
      await updateOutputBody(caseId, output.id, body);
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('review.errSave'));
    } finally { setSaving(false); }
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true); setActionError(null);
    try {
      await regenerateOutput(caseId, output.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('review.errRegenerate'));
    } finally { setRegenerating(false); }
  }

  // Copy the full ready-to-publish body of the active output, with brief feedback.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(output.body);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  // Share via the native Web Share API when available; otherwise fall back to
  // copying the content. A dismissed native sheet (AbortError) is not an error.
  async function handleShare() {
    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    // 1. If a visual is ready and its File is prefetched, try to share image + text.
    //    Uses the cached File so share() stays in the user-gesture (iOS-safe). Any
    //    failure other than user-cancel falls through to the text paths below.
    const file = visualFileRef.current;
    if (canNativeShare && file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: output.title, text: output.body, files: [file] });
        setShareState('shared');
        setTimeout(() => setShareState('idle'), 2000);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return; // user cancelled
        // any other failure → fall through to text-only share
      }
    }

    // 2. Text-only native share (unchanged behavior).
    if (canNativeShare) {
      try {
        await navigator.share({ title: output.title, text: output.body });
        setShareState('shared');
        setTimeout(() => setShareState('idle'), 2000);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return; // user cancelled
        // any other failure → fall through to the copy fallback
      }
    }
    try {
      await navigator.clipboard.writeText(`${output.title}\n\n${output.body}`);
      setShareState('copied');
    } catch {
      setShareState('error');
    }
    setTimeout(() => setShareState('idle'), 2000);
  }

  const busy = approving || rejecting || saving || regenerating;
  const hasBreakdown = !!output.breakdown && Object.keys(output.breakdown).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Action bar (top, above the draft — stays visible while reading) ── */}
      <div className="shrink-0 border-b border-outline-variant bg-surface px-4 md:px-8 py-3 flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {editing ? (
          <>
            <Button onClick={handleSaveEdit} loading={saving} disabled={busy}>
              <Icon name="save" size="sm" />
              {saving ? t('common.saving') : t('review.saveEdit')}
            </Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setBody(output.body); }} disabled={busy}>
              {t('common.cancel')}
            </Button>
          </>
        ) : (
          <>
            {/* Copy + Share — clearly accessible (icon-only below sm to avoid 3-row wrap) */}
            <Button size="sm" variant="outline" onClick={handleCopy} disabled={busy} title={t('review.copy')}>
              <Icon name={copyState === 'copied' ? 'check' : copyState === 'error' ? 'error' : 'content_copy'} size="sm" />
              <span className="hidden sm:inline">{copyState === 'copied' ? t('review.copied') : copyState === 'error' ? t('review.copyFailed') : t('review.copy')}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} disabled={busy} title={t('review.share')}>
              <Icon name={shareState === 'shared' ? 'check' : shareState === 'copied' ? 'content_copy' : shareState === 'error' ? 'error' : 'share'} size="sm" />
              <span className="hidden sm:inline">{shareState === 'shared' ? t('review.shared') : shareState === 'copied' ? t('review.copiedForSharing') : shareState === 'error' ? t('review.shareFailed') : t('review.share')}</span>
            </Button>

            <span className="hidden sm:block w-px h-6 bg-outline-variant/60 mx-1" />

            {/* Desktop utility actions (sm+). Visual button is NAVIGATION (scrolls). */}
            <div className="hidden sm:flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={status === 'approved' || busy} title={t('review.edit')}>
                <Icon name="edit" size="sm" />
                <span>{t('review.edit')}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRegenerate} loading={regenerating} disabled={busy} title={t('review.regenerate')}>
                <Icon name="refresh" size="sm" />
                <span>{regenerating ? t('review.regenerating') : t('review.regenerate')}</span>
              </Button>
              {visual.enabled && (
                <Button size="sm" variant="ghost" onClick={scrollToVisual} title="Go to visual">
                  <Icon name="image" size="sm" />
                  <span>{visual.isActive ? 'Generating…' : visual.isReady ? 'View Visual' : 'Visual'}</span>
                </Button>
              )}
            </div>

            {/* Mobile "More" menu — keeps the bar to Copy/Share/Approve/Reject + this. */}
            <div className="sm:hidden relative" ref={menuRef}>
              <Button size="sm" variant="ghost" onClick={() => setMenuOpen(o => !o)} disabled={busy} title="More actions" aria-haspopup="menu" aria-expanded={menuOpen}>
                <Icon name="more_vert" size="sm" />
              </Button>
              {menuOpen && (
                <div role="menu" className="absolute z-50 mt-1 start-0 min-w-[210px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-xl py-1">
                  <button role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true); }} disabled={status === 'approved'} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 disabled:opacity-40 text-start">
                    <Icon name="edit" size="sm" /> {t('review.edit')}
                  </button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); void handleRegenerate(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start">
                    <Icon name="refresh" size="sm" /> {t('review.regenerate')}
                  </button>
                  {visual.enabled && (
                    <button role="menuitem" onClick={() => { setMenuOpen(false); scrollToVisual(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start">
                      <Icon name="image" size="sm" /> {visual.isActive ? 'Generating…' : visual.isReady ? 'View Visual' : 'Visual'}
                    </button>
                  )}
                  {visual.enabled && visual.isReady && (
                    <>
                      <button role="menuitem" onClick={() => { setMenuOpen(false); visual.regenerate(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start">
                        <Icon name="refresh" size="sm" /> Regenerate Background
                      </button>
                      <a role="menuitem" href={visual.asset.finalUrl ?? '#'} download={`lumai-${output.platform}.png`} onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start">
                        <Icon name="download" size="sm" /> Download Visual
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Decision group — Approve / Reject. Stays inline (same row) at all sizes.
                Both buttons are ALWAYS exactly the same size (identical box classes;
                only color differs). Icon-only under 400px, icon + label above. */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {status === 'approved' && (
                <span className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-green-700">
                  <Icon name="check_circle" size="sm" /> {t('review.approved')}
                </span>
              )}
              {status === 'rejected' && (
                <span className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-error">
                  <Icon name="cancel" size="sm" /> {t('review.rejected')}
                </span>
              )}

              {/* Reject — quiet secondary: near-white with a subtle red tint + soft border */}
              {status !== 'rejected' && (
                <button
                  onClick={handleReject}
                  disabled={busy}
                  title={t('review.reject')}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3 min-w-10 min-[400px]:min-w-[104px] rounded-xl
                             bg-error/[0.06] text-error/90 font-semibold text-[13px] border border-error/20
                             transition-all duration-150 ease-out hover:bg-error/[0.10] hover:border-error/30 active:scale-[0.98]
                             disabled:opacity-60 disabled:pointer-events-none"
                >
                  {rejecting
                    ? <span className="w-4 h-4 rounded-full border-2 border-error/30 border-t-error animate-spin" />
                    : <Icon name="close" size="sm" />}
                  <span className="hidden min-[400px]:inline">{rejecting ? t('review.rejecting') : t('review.reject')}</span>
                </button>
              )}

              {/* Approve — primary, calmer flat blue (no gradient/glow/shadow) */}
              {status !== 'approved' && (
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  title={t('review.approve')}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3 min-w-10 min-[400px]:min-w-[104px] rounded-xl
                             bg-primary/90 text-white font-semibold text-[13px] border border-transparent
                             transition-all duration-150 ease-out hover:bg-primary active:scale-[0.98]
                             disabled:opacity-60 disabled:pointer-events-none"
                >
                  {approving
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    : <Icon name="check" size="sm" />}
                  <span className="hidden min-[400px]:inline">{approving ? t('review.approving') : t('review.approve')}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="shrink-0 mx-8 mt-2 flex items-center gap-2 bg-error-container/50 border border-error/20 rounded-lg px-3 py-2">
          <Icon name="error" size="sm" className="text-error shrink-0" />
          <p className="text-[12px] text-on-error-container">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-outline hover:text-on-surface">
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* ── Scrollable reading pane — the draft body (viewport-bounded height) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 max-h-[calc(100dvh-360px)] md:max-h-[calc(100vh-300px)]">
        <div className="max-w-[72ch] mx-auto space-y-6">

          {/* Draft header */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <PlatformBadge platform={output.platform} />
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isResearchDegraded(output) && <ResearchDegradedBadge />}
                {isDegraded(output) && <DegradedBadge />}
                <OutputStatusBadge status={status} />
              </div>
            </div>
            <h1 className="text-[26px] font-serif text-on-surface leading-tight" dir="auto">{output.title}</h1>
            {(output.researchConfidence != null || output.factCheckAccuracy != null) && (
              <p className="text-[12px] text-on-surface-variant mt-2 flex items-center gap-3">
                {output.researchConfidence != null && <span>{t('review.researchPct', { pct: output.researchConfidence })}</span>}
                {output.factCheckAccuracy != null && <span>{t('review.factCheckPct', { pct: output.factCheckAccuracy })}</span>}
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
              className="w-full bg-surface-container-low border border-primary rounded-xl text-[15px] leading-relaxed text-on-surface px-4 py-3 font-sans resize-y overflow-y-auto max-h-[calc(100vh-340px)] focus:ring-2 focus:ring-primary"
            />
          ) : (
            <article className="border-t border-outline-variant/30 pt-5">
              {output.body.split(/\n{2,}/).map((para, i) => (
                <p key={i} dir="auto" style={{ unicodeBidi: 'plaintext' }} className="text-[15.5px] leading-[1.8] text-on-surface mb-4 whitespace-pre-wrap text-start">
                  {para}
                </p>
              ))}
            </article>
          )}

          {/* Visual Section — directly after the post (LinkedIn / Facebook only) */}
          {!editing && visualPlatform && (
            <VisualPanel platform={visualPlatform} visual={visual} sectionRef={visualRef} />
          )}

          {/* Editorial Breakdown — moved below the visual, collapsed by default */}
          {!editing && hasBreakdown && (
            <section className="border-t border-outline-variant/30 pt-5">
              <button
                onClick={() => setShowBreakdown(v => !v)}
                className="flex items-center gap-2 text-[14px] font-semibold text-on-surface hover:text-primary transition-colors"
                aria-expanded={showBreakdown}
              >
                <Icon name={showBreakdown ? 'expand_less' : 'expand_more'} size="sm" />
                How this draft was built
              </button>
              {showBreakdown && <div className="mt-4"><EditorialBreakdown breakdown={output.breakdown!} /></div>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function ContentCaseReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, plural, formatDateTime } = useT();
  const [searchParams] = useSearchParams();
  const runIdParam = searchParams.get('runId');

  const caseItem = useLiveCase(id);
  const loading  = useContentCasesStore(s => s.loading);
  const liveOutputs = useContentCasesStore(s => s.getCaseById(id ?? '')?.outputs);
  const tabParam = searchParams.get('tab');
  const [activePlatform, setActivePlatform] = useState<ActiveTab>(
    tabParam === 'podcast' ? 'podcast_engine' : 'linkedin',
  );

  if (!caseItem) {
    return (
      <>
        <TopBar title={t('review.title')} />
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          {loading
            ? <div className="flex items-center gap-3 text-on-surface-variant"><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">{t('common.loading')}</span></div>
            : <div className="flex flex-col items-center text-center gap-4">
                <Icon name="search_off" size="xl" className="text-outline" />
                <p className="text-[15px] text-on-surface-variant">{t('review.caseNotFound')}</p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}><Icon name="arrow_back" size="sm" />{t('review.backToCases')}</Button>
              </div>}
        </main>
      </>
    );
  }

  const c = caseItem;

  const targetRunId  = runIdParam ?? c.currentRun?.id ?? null;
  const isHistorical = runIdParam !== null && runIdParam !== c.currentRun?.id;

  // Podcast Engine tab is visible when case has 'podcast' in contentTargets
  const hasPodcastTarget = c.contentTargets?.includes('podcast') ?? false;

  const allRunOutputs = targetRunId
    ? c.outputs.filter(o => o.pipelineRunId === targetRunId)
    : c.outputs;

  // When Podcast Engine is active, filter out legacy platform='podcast' ContentOutputs
  // so they don't appear as a duplicate tab in the regular output list.
  const reviewOutputs = hasPodcastTarget
    ? allRunOutputs.filter(o => o.platform !== 'podcast')
    : allRunOutputs;

  const statusOf = (o: ContentOutput) => liveOutputs?.find(x => x.id === o.id)?.status ?? o.status;
  const approvedCount = reviewOutputs.filter(o => statusOf(o) === 'approved').length;
  const totalCount    = reviewOutputs.length;
  const allReviewed   = totalCount > 0 && reviewOutputs.every(o => statusOf(o) !== 'draft');

  const sortedOutputs = [...reviewOutputs].sort((a, b) =>
    PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );

  const isPodcastActive = activePlatform === 'podcast_engine';
  const resolvedPlatform: Platform = (!isPodcastActive && sortedOutputs.find(o => o.platform === activePlatform))
    ? (activePlatform as Platform)
    : (sortedOutputs[0]?.platform ?? 'linkedin');
  const activeOutput = sortedOutputs.find(o => o.platform === resolvedPlatform) ?? sortedOutputs[0];

  // Run context for the header (thesis/integrity available for the current run).
  const thesis      = !isHistorical ? (c.currentRun?.thesis ?? null) : null;
  const integrity   = !isHistorical ? (c.currentRun?.research ?? null) : null;
  const generatedAt = (!isHistorical && c.currentRun?.completedAt) || sortedOutputs[0]?.generatedAt || null;
  const sourceCount = c.currentRun?.sourceCount ?? c.sources.length;

  const integrityChip = integrity && (
    integrity.status === 'success'
      ? { label: t('review.integrity.real'), tone: 'text-green-700', icon: 'verified' }
      : integrity.status === 'degraded'
        ? { label: t('review.integrity.degraded'), tone: 'text-red-700', icon: 'warning' }
        : { label: t('review.integrity.mock'), tone: 'text-amber-700', icon: 'science' }
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
              {t('review.backToCase')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Historical-run banner */}
        {isHistorical && (
          <div className="px-4 md:px-8 py-2.5 bg-secondary-container/40 border-b border-outline-variant flex items-center gap-3 text-[13px] text-on-secondary-container">
            <Icon name="history" size="sm" />
            <span>{t('review.historicalBanner')}
              <button onClick={() => navigate(`/cases/${c.id}/review`)} className="font-bold underline hover:no-underline">{t('review.switchToCurrent')}</button>
            </span>
          </div>
        )}

        {/* ── Rich review header ─────────────────────────────── */}
        <div className="px-4 md:px-8 py-5 bg-surface-container-low border-b border-outline-variant">
          <div className="flex items-center gap-3 flex-wrap text-[12px] text-on-surface-variant mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-on-surface">
              <Icon name={isHistorical ? 'history' : 'bolt'} size="sm" className="text-primary" />
              {isHistorical ? t('review.historicalRun') : t('review.currentRun')}
            </span>
            {generatedAt && (
              <span className="inline-flex items-center gap-1">
                <Icon name="schedule" size="sm" className="text-outline" />
                {t('review.generatedAt', { datetime: formatDateTime(generatedAt) })}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="article" size="sm" className="text-outline" />
              {plural(sourceCount, 'review.sourceCountOne', 'review.sourceCountOther')}
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">{t('review.coreThesis')}</p>
                <p className="text-[15px] font-serif text-on-surface leading-snug" dir="auto">{thesis}</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-variant italic">{t('review.noThesis')}</p>
          )}
        </div>

        {/* ── Two-column workspace ───────────────────────────── */}
        {reviewOutputs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <Icon name="auto_awesome" size="xl" className="text-outline mb-4" />
            <p className="text-[16px] font-medium text-on-surface-variant">
              {isHistorical ? t('review.noOutputsHistorical') : t('review.noOutputsCurrent')}
            </p>
            <p className="text-[14px] text-outline mt-1">
              {isHistorical ? t('review.noOutputsHistoricalHint') : t('review.noOutputsCurrentHint')}
            </p>
            {!isHistorical && (
              <Button className="mt-6" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>{t('review.goToPipeline')}</Button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex overflow-hidden">

            {/* Left rail — progress + output navigation */}
            <aside className="hidden md:flex md:flex-col w-72 shrink-0 border-r border-outline-variant bg-surface-container-low/40 overflow-y-auto">
              <div className="p-5 border-b border-outline-variant/40">
                <div className="flex items-center justify-between text-[12px] text-on-surface-variant mb-1.5">
                  <span>{t('review.reviewProgress')}</span>
                  <span className="font-bold text-on-surface">{approvedCount}/{totalCount}</span>
                </div>
                <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all rounded-full" style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }} />
                </div>
                {allReviewed && (
                  <div className="mt-3 flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-[12px] font-bold">
                    <Icon name="celebration" size="sm" /> {t('review.allReviewed')}
                  </div>
                )}
              </div>
              <nav className="p-3 space-y-1">
                {sortedOutputs.map(output => {
                  const st = statusOf(output);
                  const active = !isPodcastActive && output.platform === resolvedPlatform;
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
                        {st === 'draft' && <span className="w-2 h-2 rounded-full bg-amber-400" title={t('review.pendingReview')} />}
                      </div>
                    </button>
                  );
                })}
                {/* Podcast Engine tab */}
                {hasPodcastTarget && (
                  <button
                    onClick={() => setActivePlatform('podcast_engine')}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${isPodcastActive ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-container'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="mic" size="sm" />
                      <span className="text-[13px] font-medium flex-1">{t('podcast.tab')}</span>
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
                        {t('podcast.betaBadge')}
                      </span>
                    </div>
                  </button>
                )}
              </nav>
            </aside>

            {/* Main draft pane */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Mobile tab bar */}
              <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b border-outline-variant bg-surface">
                {sortedOutputs.map(output => (
                  <button
                    key={output.id}
                    onClick={() => setActivePlatform(output.platform)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${!isPodcastActive && output.platform === resolvedPlatform ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    <Icon name={platformIcon[output.platform]} size="sm" />
                    {platformName(output.platform)}
                    {statusOf(output) === 'approved' && <Icon name="check_circle" size="sm" className="text-green-600" />}
                  </button>
                ))}
                {hasPodcastTarget && (
                  <button
                    onClick={() => setActivePlatform('podcast_engine')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${isPodcastActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    <Icon name="mic" size="sm" />
                    {t('podcast.tab')}
                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded-full leading-none">
                      {t('podcast.betaBadge')}
                    </span>
                  </button>
                )}
              </div>

              {isPodcastActive
                ? <PodcastPanel caseId={c.id} pipelineRunId={targetRunId} autoStart={hasPodcastTarget && !isHistorical} />
                : activeOutput && <DraftPane key={activeOutput.id} output={activeOutput} caseId={c.id} />
              }
            </div>
          </div>
        )}
      </main>
    </>
  );
}
