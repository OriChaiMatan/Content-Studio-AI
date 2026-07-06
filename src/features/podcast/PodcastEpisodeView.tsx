import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import type { PodcastEpisodeFull, EpisodeSection, PodcastPackage } from './types';

// ── Data helpers ──────────────────────────────────────────────────────────────

// Safely read the narration sections from full.sections (the DB `sections` column).
// Returns [] for any shape that is not a non-empty array.
function getSections(full: PodcastEpisodeFull): EpisodeSection[] {
  if (!Array.isArray(full.sections) || full.sections.length === 0) return [];
  return full.sections as EpisodeSection[];
}

function getPkg(full: PodcastEpisodeFull): PodcastPackage | null {
  if (!full.podcastPackage || typeof full.podcastPackage !== 'object') return null;
  return full.podcastPackage as PodcastPackage;
}

function safeStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter(x => typeof x === 'string') as string[] : [];
}

// ── Download helpers ──────────────────────────────────────────────────────────

function buildMarkdown(title: string, subtitle: string, pkg: PodcastPackage, sections: EpisodeSection[]): string {
  return [
    `# ${title}`,
    subtitle ? `\n*${subtitle}*` : '',
    '\n---',
    '\n## Executive Summary\n',
    pkg.executiveSummary ?? '',
    '\n## Key Takeaways\n',
    ...safeStringArray(pkg.keyTakeaways).map(t => `- ${t}`),
    '\n---',
    ...sections.map(s => `\n## ${s.name}\n\n${s.narration}`),
  ].join('\n');
}

function buildPlainText(title: string, subtitle: string, pkg: PodcastPackage, sections: EpisodeSection[]): string {
  const hr = '─'.repeat(60);
  return [
    title.toUpperCase(),
    subtitle,
    '',
    hr,
    '',
    'EXECUTIVE SUMMARY',
    '',
    pkg.executiveSummary ?? '',
    '',
    'KEY TAKEAWAYS',
    '',
    ...safeStringArray(pkg.keyTakeaways).map((t, i) => `${i + 1}. ${t}`),
    '',
    hr,
    ...sections.map(s => `\n${s.name.toUpperCase()}\n\n${s.narration}`),
  ].join('\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Episode classification ────────────────────────────────────────────────────

function episodeTypeKey(density: string): StringKey | null {
  switch (density) {
    case 'high':    return 'podcast.meta.deepDive';
    case 'medium':  return 'podcast.meta.standardEpisode';
    case 'limited': return 'podcast.meta.shortBriefing';
    default:        return null;
  }
}

// ── Quality badge ─────────────────────────────────────────────────────────────

function QualityBadge({ status }: { status: string | null }) {
  const { t } = useT();
  if (!status) return null;
  const cfg: Record<string, { label: string; cls: string }> = {
    pass:         { label: t('podcast.meta.qualityPass'),    cls: 'bg-green-100 text-green-700' },
    needs_review: { label: t('podcast.meta.qualityReview'),  cls: 'bg-amber-100 text-amber-700' },
    blocked:      { label: t('podcast.meta.qualityBlocked'), cls: 'bg-red-100 text-red-700' },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${c.cls}`}>
      <Icon name="verified" size="sm" />
      {c.label}
    </span>
  );
}

// ── Desktop sticky section nav ────────────────────────────────────────────────

function SectionNav({ sections, activeIdx, onSelect }: {
  sections: EpisodeSection[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const { t } = useT();
  if (!sections.length) return null;
  return (
    <nav aria-label={t('podcast.section.sections')} className="hidden lg:block w-44 shrink-0 self-start">
      <div className="sticky top-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-2.5 px-2">
          {t('podcast.section.sections')}
        </p>
        <div className="space-y-0.5">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={[
                'w-full text-start px-2.5 py-1.5 rounded-lg text-[12px] transition-colors leading-snug',
                i === activeIdx
                  ? 'bg-secondary-container/70 text-on-secondary-container font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container',
              ].join(' ')}
              dir="auto"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ── Mobile collapsible section nav ────────────────────────────────────────────

function MobileSectionNav({ sections, activeIdx, onSelect }: {
  sections: EpisodeSection[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  if (sections.length === 0) return null;
  return (
    <div className="lg:hidden border border-outline-variant/30 rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-container text-[13px] font-medium text-on-surface"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon name="list" size="sm" className="text-outline shrink-0" />
          <span className="shrink-0">{t('podcast.section.sections')}:</span>
          <span className="text-primary truncate" dir="auto">{sections[activeIdx]?.name}</span>
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-outline shrink-0 ms-2" />
      </button>
      {open && (
        <div className="border-t border-outline-variant/20 divide-y divide-outline-variant/10">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); onSelect(i); }}
              className={[
                'w-full text-start px-4 py-2.5 text-[13px] transition-colors',
                i === activeIdx
                  ? 'bg-secondary-container/40 text-on-secondary-container font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container',
              ].join(' ')}
              dir="auto"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Research Notes tab ────────────────────────────────────────────────────────

// Matches backend ResearchPack shape (podcastSpikeTypes.ts)
interface ResearchPackShape {
  claims?: Array<{ text: string; confidence?: string; sourceRef?: string }>;
  keyFacts?: string[];
  keyNumbers?: string[];
  sourceRefs?: string[];
  openQuestions?: string[];
  researchNotes?: {
    verifiedFacts?: Array<{ fact: string; source?: string }>;
    primarySources?: string[];
    lowerConfidenceClaims?: string[];
  };
}

// Matches backend CriticReport shape (podcastSpikeTypes.ts)
const CRITIQUE_DIM_KEYS = [
  'thesisClarity', 'openingStrength', 'factualIntegrity',
  'spokenNaturalness', 'narrativeCoherence', 'retellTestReadiness',
] as const;

type CritiqueDimKey = typeof CRITIQUE_DIM_KEYS[number];

const DIM_LABEL: Record<CritiqueDimKey, string> = {
  thesisClarity:        'Thesis Clarity',
  openingStrength:      'Opening Strength',
  factualIntegrity:     'Factual Integrity',
  spokenNaturalness:    'Spoken Naturalness',
  narrativeCoherence:   'Narrative Coherence',
  retellTestReadiness:  'Retell-Test Readiness',
};

function ResearchNotes({ full }: { full: PodcastEpisodeFull }) {
  const { t } = useT();

  const pack = (full.researchPack && typeof full.researchPack === 'object')
    ? full.researchPack as ResearchPackShape
    : null;

  const critique = (full.critique && typeof full.critique === 'object')
    ? full.critique as Record<string, unknown>
    : null;

  const claims      = Array.isArray(pack?.claims)    ? pack!.claims    : [];
  const keyFacts    = safeStringArray(pack?.keyFacts);
  const keyNumbers  = safeStringArray(pack?.keyNumbers);
  const sourceRefs  = safeStringArray(pack?.sourceRefs);
  const openQs      = safeStringArray(pack?.openQuestions);
  const overallScore = typeof critique?.overallScore === 'number' ? critique.overallScore : null;

  const critiqueDims = CRITIQUE_DIM_KEYS
    .map(k => {
      const d = critique?.[k];
      if (!d || typeof d !== 'object') return null;
      const dim = d as { score?: number; findings?: string };
      if (typeof dim.score !== 'number') return null;
      return { key: k, label: DIM_LABEL[k], score: dim.score, findings: dim.findings ?? '' };
    })
    .filter(Boolean) as Array<{ key: string; label: string; score: number; findings: string }>;

  const hasContent = claims.length > 0 || keyFacts.length > 0 || keyNumbers.length > 0
    || sourceRefs.length > 0 || openQs.length > 0 || overallScore !== null;

  if (!hasContent) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="space-y-3">
          <Icon name="science" className="text-outline" />
          <p className="text-[14px] text-on-surface-variant">{t('podcast.notes.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[72ch] mx-auto px-4 md:px-8 py-6 space-y-7">
        {/* Disclaimer */}
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-container border border-outline-variant/30 px-4 py-3">
          <Icon name="info" size="sm" className="text-outline shrink-0 mt-0.5" />
          <p className="text-[12px] text-on-surface-variant leading-relaxed">{t('podcast.notes.intro')}</p>
        </div>

        {/* Research Claims */}
        {claims.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="fact_check" size="sm" /> {t('podcast.notes.keyFacts')}
            </h3>
            <ul className="space-y-2.5">
              {claims.map((c, i) => {
                const uncertain = c.confidence === 'uncertain';
                return (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] text-on-surface leading-relaxed" dir="auto">
                    <Icon
                      name={uncertain ? 'help' : 'check_circle'}
                      size="sm"
                      className={`shrink-0 mt-0.5 ${uncertain ? 'text-amber-500' : 'text-green-600'}`}
                    />
                    <span style={{ unicodeBidi: 'plaintext' }}>{c.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Key Facts (simple strings) */}
        {keyFacts.length > 0 && claims.length === 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="fact_check" size="sm" /> {t('podcast.notes.keyFacts')}
            </h3>
            <ul className="space-y-2.5">
              {keyFacts.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] text-on-surface leading-relaxed" dir="auto">
                  <Icon name="check_circle" size="sm" className="shrink-0 mt-0.5 text-green-600" />
                  <span style={{ unicodeBidi: 'plaintext' }}>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Key Numbers */}
        {keyNumbers.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="numbers" size="sm" /> {t('podcast.notes.keyNumbers')}
            </h3>
            <ul className="space-y-1.5">
              {keyNumbers.map((n, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[14px] text-on-surface" dir="auto">
                  <Icon name="fiber_manual_record" size="sm" className="text-primary/50 shrink-0" />
                  <span style={{ unicodeBidi: 'plaintext' }}>{n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Open Questions */}
        {openQs.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="help_outline" size="sm" /> {t('podcast.notes.openQuestions')}
            </h3>
            <ul className="space-y-2">
              {openQs.map((q, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-on-surface-variant leading-relaxed" dir="auto">
                  <span className="shrink-0 text-outline mt-0.5">?</span>
                  <span style={{ unicodeBidi: 'plaintext' }}>{q}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sources */}
        {sourceRefs.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="article" size="sm" /> {t('podcast.notes.sources')}
            </h3>
            <ul className="space-y-1.5">
              {sourceRefs.map((src, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant" dir="auto">
                  <Icon name="link" size="sm" className="shrink-0 mt-0.5 text-outline" />
                  <span className="truncate" style={{ unicodeBidi: 'plaintext' }}>{src}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Quality & Confidence */}
        {(overallScore !== null || critiqueDims.length > 0) && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
              <Icon name="verified" size="sm" /> {t('podcast.notes.confidence')}
            </h3>
            {overallScore !== null && (
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[13px] text-on-surface-variant">{t('podcast.notes.overallScore')}</span>
                <span className="text-[24px] font-bold text-primary leading-none">{overallScore}</span>
                <span className="text-[13px] text-outline">/10</span>
              </div>
            )}
            {critiqueDims.length > 0 && (
              <div className="space-y-2">
                {critiqueDims.map(dim => (
                  <div key={dim.key} className="flex items-start gap-3 text-[13px]">
                    <span className="w-40 shrink-0 text-on-surface-variant text-[12px]">{dim.label}</span>
                    <span className="w-7 text-end font-bold text-primary shrink-0">{dim.score}</span>
                    <span className="flex-1 text-on-surface-variant text-[12px] leading-relaxed">
                      {dim.findings}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  full: PodcastEpisodeFull;
  onRegenerate: () => void;
  regenerating: boolean;
  sourceCount?: number;
}

export function PodcastEpisodeView({ full, onRegenerate, regenerating, sourceCount }: Props) {
  const { t, locale } = useT();
  const [activeTab, setActiveTab] = useState<'episode' | 'research'>('episode');
  const [activeIdx, setActiveIdx] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  const pkg       = getPkg(full);
  const sections  = getSections(full);
  const isRTL     = full.language === 'he';
  const typeKey   = episodeTypeKey(full.researchDensity);

  // Trim stale refs when section count shrinks
  if (sectionRefs.current.length > sections.length) {
    sectionRefs.current = sectionRefs.current.slice(0, sections.length);
  }

  // Close download menu on outside click
  useEffect(() => {
    if (!downloadOpen) return;
    function onDoc(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [downloadOpen]);

  // Section intersection observer
  useEffect(() => {
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = parseInt(visible.target.getAttribute('data-section-idx') ?? '0', 10);
          if (!isNaN(idx)) setActiveIdx(idx);
        }
      },
      { threshold: 0, rootMargin: '-15% 0px -55% 0px' },
    );
    sectionRefs.current.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [sections.length]);

  function scrollToSection(idx: number) {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function copyEpisode() {
    const narration = sections.map(s => `${s.name}\n\n${s.narration}`).join('\n\n---\n\n');
    const summary = pkg?.executiveSummary ?? '';
    const text = [full.title, full.subtitle, '', summary, '', narration].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => { setCopyState('copied'); setTimeout(() => setCopyState('idle'), 2000); })
      .catch(() => {});
  }

  function handleDownload(fmt: 'md' | 'txt') {
    if (!pkg) return;
    setDownloadOpen(false);
    const slug = full.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 40) || 'episode';
    if (fmt === 'md') {
      downloadFile(buildMarkdown(full.title, full.subtitle, pkg, sections), `${slug}.md`, 'text/markdown');
    } else {
      downloadFile(buildPlainText(full.title, full.subtitle, pkg, sections), `${slug}.txt`, 'text/plain');
    }
  }

  const genDate = full.completedAt
    ? new Date(full.completedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  const keyTakeaways = safeStringArray(pkg?.keyTakeaways);

  return (
    <div className="flex flex-col h-full">

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-outline-variant bg-surface px-4 md:px-6 py-3 flex items-center gap-1.5 flex-wrap">

        <Button size="sm" variant="outline" onClick={copyEpisode} title={t('podcast.action.copy')}>
          <Icon name={copyState === 'copied' ? 'check' : 'content_copy'} size="sm" />
          <span className="hidden sm:inline">
            {copyState === 'copied' ? t('podcast.action.copied') : t('podcast.action.copy')}
          </span>
        </Button>

        <div className="relative" ref={downloadRef}>
          <Button size="sm" variant="outline" onClick={() => setDownloadOpen(o => !o)} disabled={!pkg} title={t('podcast.action.download')}>
            <Icon name="download" size="sm" />
            <span className="hidden sm:inline">{t('podcast.action.download')}</span>
            <Icon name="expand_more" size="sm" />
          </Button>
          {downloadOpen && (
            <div className="absolute z-50 mt-1 start-0 min-w-[150px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-xl py-1">
              <button
                onClick={() => handleDownload('md')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start"
              >
                <Icon name="code" size="sm" /> {t('podcast.action.downloadMd')}
              </button>
              <button
                onClick={() => handleDownload('txt')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-on-surface hover:bg-surface-variant/40 text-start"
              >
                <Icon name="text_snippet" size="sm" /> {t('podcast.action.downloadTxt')}
              </button>
            </div>
          )}
        </div>

        <span className="hidden sm:block w-px h-5 bg-outline-variant/60 mx-0.5" />

        <Button size="sm" variant="ghost" onClick={onRegenerate} loading={regenerating} disabled={regenerating} title={t('podcast.action.regenerate')}>
          <Icon name="refresh" size="sm" />
          <span className="hidden sm:inline">
            {regenerating ? t('podcast.action.regenerating') : t('podcast.action.regenerate')}
          </span>
        </Button>

        <div className="flex-1" />

        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Beta</span>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-outline-variant bg-surface px-4 md:px-6 flex gap-0.5">
        {(['episode', 'research'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {tab === 'episode' ? t('podcast.tab.episode') : t('podcast.tab.researchNotes')}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {activeTab === 'research' ? (
        <ResearchNotes full={full} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 flex gap-10">

            {/* Main article */}
            <article className="flex-1 min-w-0" dir={isRTL ? 'rtl' : undefined}>

              {/* Episode header */}
              <header className="mb-6 pb-5 border-b border-outline-variant/30">
                <h1
                  className="text-[26px] md:text-[30px] font-serif font-bold text-on-surface leading-tight mb-2.5"
                  dir="auto"
                >
                  {full.title || t('podcast.meta.untitled')}
                </h1>
                {full.subtitle && (
                  <p
                    className="text-[16px] text-on-surface-variant leading-relaxed mb-4 font-serif"
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {full.subtitle}
                  </p>
                )}

                {/* Metadata strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-on-surface-variant">
                  {typeKey && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium text-[11px]">
                      <Icon name="podcasts" size="sm" />
                      {t(typeKey)}
                    </span>
                  )}
                  {full.estimatedDurationMin > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon name="schedule" size="sm" className="text-outline" />
                      {t('podcast.meta.duration', { min: full.estimatedDurationMin })}
                    </span>
                  )}
                  {full.wordCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon name="text_fields" size="sm" className="text-outline" />
                      {t('podcast.meta.words', { count: full.wordCount.toLocaleString(locale) })}
                    </span>
                  )}
                  {(sourceCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon name="article" size="sm" className="text-outline" />
                      {t('podcast.meta.sources', { count: sourceCount ?? 0 })}
                    </span>
                  )}
                  {genDate && (
                    <span className="flex items-center gap-1">
                      <Icon name="event" size="sm" className="text-outline" />
                      {genDate}
                    </span>
                  )}
                  <QualityBadge status={full.qualityStatus} />
                </div>
              </header>

              {/* Executive Summary */}
              {pkg?.executiveSummary && (
                <section className="mb-6 rounded-xl bg-surface-container-low border border-outline-variant/30 px-5 py-4">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2.5">
                    {t('podcast.section.summary')}
                  </h2>
                  <p
                    className="text-[15.5px] text-on-surface leading-[1.8] font-serif"
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {pkg.executiveSummary}
                  </p>
                </section>
              )}

              {/* Key Takeaways */}
              {keyTakeaways.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-3">
                    {t('podcast.section.takeaways')}
                  </h2>
                  <ul className="space-y-2.5">
                    {keyTakeaways.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[14.5px] text-on-surface leading-relaxed"
                        dir="auto"
                      >
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span style={{ unicodeBidi: 'plaintext' }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Mobile section accordion */}
              <MobileSectionNav sections={sections} activeIdx={activeIdx} onSelect={scrollToSection} />

              {/* Narration sections */}
              {sections.length > 0 ? (
                <div className="space-y-0">
                  {sections.map((section, idx) => (
                    <section
                      key={idx}
                      ref={el => { sectionRefs.current[idx] = el; }}
                      data-section-idx={idx}
                      className="pt-7 pb-1 scroll-mt-6 border-t border-outline-variant/20 first:border-t-0"
                    >
                      <h2
                        className="text-[20px] font-serif font-semibold text-on-surface mb-4 leading-snug"
                        dir="auto"
                      >
                        {section.name}
                      </h2>
                      {section.narration.split(/\n{2,}/).map((para, pi) => (
                        <p
                          key={pi}
                          className="text-[15.5px] leading-[1.85] text-on-surface mb-4 whitespace-pre-wrap"
                          dir="auto"
                          style={{
                            unicodeBidi: 'plaintext',
                            textAlign: isRTL ? 'right' : 'start',
                          }}
                        >
                          {para}
                        </p>
                      ))}
                    </section>
                  ))}
                </div>
              ) : (
                /* Completed but sections missing — malformed episode */
                <div className="flex flex-col items-center py-16 text-center">
                  <Icon name="mic_off" className="text-outline mb-3" />
                  <p className="text-[15px] font-medium text-on-surface mb-1">
                    {t('podcast.fallback.title')}
                  </p>
                  <p className="text-[13px] text-on-surface-variant max-w-[340px]">
                    {t('podcast.fallback.hint')}
                  </p>
                </div>
              )}
            </article>

            {/* Desktop sticky section nav */}
            <SectionNav sections={sections} activeIdx={activeIdx} onSelect={scrollToSection} />
          </div>
        </div>
      )}
    </div>
  );
}
