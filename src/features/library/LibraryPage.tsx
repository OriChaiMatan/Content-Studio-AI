import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { PlatformBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useLibraryStore } from '../../stores/libraryStore';
import { useT } from '../../i18n/useT';
import type { LibraryRunGroup, LibraryItem, Platform } from '../../types';

// Human label for the platform filter chips (badge component isn't a toggle).
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin:   'LinkedIn',
  facebook:   'Facebook',
  newsletter: 'Newsletter',
  podcast:    'Podcast',
};

// ── Individual output item (inside an expanded run card) ──

function OutputItem({ item }: { item: LibraryItem }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  const isLong = item.body.length > 200;

  function copy() {
    navigator.clipboard?.writeText(item.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border border-outline-variant/20 rounded-lg bg-surface-container-lowest overflow-hidden">
      <div className="flex items-start justify-between p-3 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <PlatformBadge platform={item.platform} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-on-surface truncate text-start" dir="auto">{item.title}</p>
          <p dir="auto" style={{ unicodeBidi: 'plaintext' }} className={`text-[12px] text-on-surface-variant mt-0.5 text-start whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
            {item.body}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-primary mt-1 hover:underline">
              {expanded ? t('library.showLess') : t('library.showMore')}
            </button>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={copy}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
            title={t('library.copyToClipboard')}
          >
            <Icon name={copied ? 'check' : 'content_copy'} size="sm" className={copied ? 'text-green-600' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run card ──────────────────────────────────────────────

function RunCard({ group }: { group: LibraryRunGroup }) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { t, plural, locale } = useT();

  const runDate = new Date(group.runDate).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const runTime = new Date(group.runDate).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  });

  // Preview / copy source: the first approved output in the run.
  const primary = group.items[0];

  function copyPrimary() {
    if (!primary) return;
    navigator.clipboard?.writeText(primary.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Card header — always visible. <div role="button"> so the action buttons
          below aren't nested inside a <button> (invalid HTML). */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        className="w-full text-left px-5 py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-4 cursor-pointer select-none"
      >
        {/* Icon + info — a row at every width; actions stack below on mobile */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Saved-asset icon */}
          <div className="w-9 h-9 rounded-lg bg-secondary-container/60 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="bookmark" size="sm" className="text-on-secondary-container" />
          </div>

          {/* Run info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-[15px] font-medium text-on-surface">{group.caseTitle}</p>
              <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full whitespace-nowrap">
                {runDate} · {runTime}
              </span>
            </div>

            {/* Platform chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {group.platforms.map(p => (
                <PlatformBadge key={p} platform={p} />
              ))}
            </div>

            {/* Content preview snippet (first approved output) */}
            {primary && (
              <p dir="auto" style={{ unicodeBidi: 'plaintext' }} className="text-[12.5px] leading-relaxed text-on-surface-variant mt-2.5 line-clamp-2 text-start whitespace-pre-wrap">
                {primary.body}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2.5 text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1">
                <Icon name="check_circle" size="sm" className="text-green-600" />
                <span><span className="font-bold text-on-surface">{group.approvedCount}</span> {t('library.approved')}</span>
              </span>
              {group.sourceCount > 0 && (
                <span className="flex items-center gap-1">
                  <Icon name="article" size="sm" className="text-outline" />
                  <span><span className="font-bold text-on-surface">{group.sourceCount}</span> {plural(group.sourceCount, 'library.sourceOne', 'library.sourceOther')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions — inline on desktop; full-width bottom row on mobile */}
        <div
          className="flex items-center gap-2 shrink-0 w-full md:w-auto md:mt-0.5 border-t md:border-t-0 border-outline-variant/20 pt-3 md:pt-0"
          onClick={e => e.stopPropagation()}
        >
          {primary && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); copyPrimary(); }}
              className={`flex flex-1 md:flex-none items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                copied ? 'bg-green-100 text-green-700' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
              title={t('library.copyApproved')}
            >
              <Icon name={copied ? 'check' : 'content_copy'} size="sm" />
              {copied ? t('library.copied') : t('common.copy')}
            </button>
          )}
          {group.runId && (
            <button
              type="button"
              onClick={() => navigate(`/cases/${group.caseId}/review?runId=${group.runId}`)}
              className="flex flex-1 md:flex-none items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 rounded-lg text-[12px] font-medium bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors"
              title={t('library.viewRunContent')}
            >
              <Icon name="visibility" size="sm" />
              {t('library.viewContent')}
            </button>
          )}
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-outline shrink-0" />
        </div>
      </div>

      {/* Expanded output items */}
      {open && (
        <div className="border-t border-outline-variant/20 px-5 pb-4 pt-3 space-y-2">
          <p className="text-[11px] text-outline uppercase font-bold tracking-wider mb-2">
            {t('library.approvedOutputsFromRun')}
          </p>
          {group.items.map(item => (
            <OutputItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function LibraryPage() {
  const { runs, loading, filteredRuns, setQuery, fetchLibrary } = useLibraryStore();
  const navigate = useNavigate();
  const { t, plural } = useT();
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');

  // Platforms actually present in the library (for the filter chips).
  const availablePlatforms = [...new Set(runs.flatMap(r => r.platforms))];

  const searched = filteredRuns();
  const displayRuns = platformFilter === 'all'
    ? searched
    : searched.filter(g => g.platforms.includes(platformFilter));

  return (
    <>
      <TopBar
        title={t('nav.library')}
        searchPlaceholder={t('library.searchPlaceholder')}
        onSearch={setQuery}
        actions={
          <button
            onClick={fetchLibrary}
            disabled={loading}
            className="text-on-surface-variant hover:text-primary transition-colors"
            title={t('library.refresh')}
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface">

          {/* Stats bar */}
          {runs.length > 0 && (
            <div className="flex items-center gap-6 mb-5 text-[13px] text-on-surface-variant">
              <span>
                <span className="font-bold text-on-surface">{runs.length}</span> {plural(runs.length, 'library.savedAssetOne', 'library.savedAssetOther')}
              </span>
              <span>
                <span className="font-bold text-on-surface">
                  {runs.reduce((n, r) => n + r.approvedCount, 0)}
                </span> {t('library.approvedOutputs')}
              </span>
            </div>
          )}

          {/* Platform filter chips */}
          {availablePlatforms.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button
                onClick={() => setPlatformFilter('all')}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  platformFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t('library.all')}
              </button>
              {availablePlatforms.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    platformFilter === p ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {PLATFORM_LABEL[p] ?? p}
                </button>
              ))}
            </div>
          )}

          {/* Run list */}
          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="text-[14px]">{t('library.loading')}</span>
            </div>

          ) : displayRuns.length === 0 ? (
            runs.length > 0 ? (
              // Has content, but the current search/filter matched nothing.
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                  <Icon name="search_off" size="xl" className="text-outline" />
                </div>
                <p className="text-[16px] font-medium text-on-surface-variant">{t('library.noMatching')}</p>
                <p className="text-[14px] text-outline mt-1">{t('library.noMatchingHint')}</p>
              </div>
            ) : (
              // Truly empty library.
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                  <Icon name="auto_stories" size="xl" className="text-outline" />
                </div>
                <p className="text-[16px] font-semibold text-on-surface">{t('library.empty')}</p>
                <p className="text-[14px] text-on-surface-variant mt-1 max-w-sm">
                  {t('library.emptyHint')}
                </p>
                <button
                  onClick={() => navigate('/cases/new')}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-medium hover:bg-primary/90 transition-colors"
                >
                  <Icon name="add" size="sm" />
                  {t('library.createCase')}
                </button>
              </div>
            )

          ) : (
            <div className="space-y-4 max-w-3xl">
              {displayRuns.map(group => (
                <RunCard
                  key={group.runId ?? `solo-${group.items[0]?.outputId}`}
                  group={group}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="h-14 px-4 md:px-8 bg-surface-container-low flex items-center border-t border-outline-variant">
          <p className="text-[11px] text-on-surface-variant">
            {plural(displayRuns.length, 'library.footerOne', 'library.footerOther', {
              outputs: displayRuns.reduce((n, r) => n + r.approvedCount, 0),
              runs: displayRuns.length,
            })}
          </p>
        </footer>
      </div>
    </>
  );
}
