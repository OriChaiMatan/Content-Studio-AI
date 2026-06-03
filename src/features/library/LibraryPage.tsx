import { useState } from 'react';
import { TopBar } from '../../components/layout/TopBar';
import { PlatformBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useLibraryStore } from '../../stores/libraryStore';
import type { LibraryRunGroup, LibraryItem } from '../../types';

// ── Individual output item (inside an expanded run card) ──

function OutputItem({ item }: { item: LibraryItem }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.body.length > 200;

  return (
    <div className="border border-outline-variant/20 rounded-lg bg-surface-container-lowest overflow-hidden">
      <div className="flex items-start justify-between p-3 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <PlatformBadge platform={item.platform} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-on-surface truncate">{item.title}</p>
          <p className={`text-[12px] text-on-surface-variant mt-0.5 ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
            {item.body}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-primary mt-1 hover:underline">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => navigator.clipboard?.writeText(item.body)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
            title="Copy to clipboard"
          >
            <Icon name="content_copy" size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run card ──────────────────────────────────────────────

function RunCard({ group }: { group: LibraryRunGroup }) {
  const [open, setOpen] = useState(false);

  const runDate = new Date(group.runDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const runTime = new Date(group.runDate).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        {/* Run status dot */}
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="check_circle" size="sm" className="text-green-700" />
        </div>

        {/* Run info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[15px] font-medium text-on-surface">{group.caseTitle}</p>
            <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {runDate} · {runTime}
            </span>
          </div>

          {/* Platform chips */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {group.platforms.map(p => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Icon name="check_circle" size="sm" className="text-green-600" />
              <span><span className="font-bold text-on-surface">{group.approvedCount}</span> approved</span>
            </span>
            {group.sourceCount > 0 && (
              <span className="flex items-center gap-1">
                <Icon name="article" size="sm" className="text-outline" />
                <span><span className="font-bold text-on-surface">{group.sourceCount}</span> source{group.sourceCount !== 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
        </div>

        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="text-outline shrink-0 mt-1"
        />
      </button>

      {/* Expanded output items */}
      {open && (
        <div className="border-t border-outline-variant/20 px-5 pb-4 pt-3 space-y-2">
          <p className="text-[11px] text-outline uppercase font-bold tracking-wider mb-2">
            Approved outputs from this run
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

  const displayRuns = filteredRuns();

  return (
    <>
      <TopBar
        title="Library"
        searchPlaceholder="Search approved content..."
        onSearch={setQuery}
        actions={
          <button
            onClick={fetchLibrary}
            disabled={loading}
            className="text-on-surface-variant hover:text-primary transition-colors"
            title="Refresh"
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 bg-surface">

          {/* Stats bar */}
          {runs.length > 0 && (
            <div className="flex items-center gap-6 mb-6 text-[13px] text-on-surface-variant">
              <span>
                <span className="font-bold text-on-surface">{runs.length}</span> pipeline run{runs.length !== 1 ? 's' : ''} in library
              </span>
              <span>
                <span className="font-bold text-on-surface">
                  {runs.reduce((n, r) => n + r.approvedCount, 0)}
                </span> total approved outputs
              </span>
            </div>
          )}

          {/* Run list */}
          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="text-[14px]">Loading library…</span>
            </div>

          ) : displayRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                <Icon name="auto_stories" size="xl" className="text-outline" />
              </div>
              <p className="text-[16px] font-medium text-on-surface-variant">
                {runs.length > 0 ? 'No results for your search' : 'Library is empty'}
              </p>
              <p className="text-[14px] text-outline mt-1">
                {runs.length > 0
                  ? 'Try a different search term.'
                  : 'Approve outputs from the Review page to save them here.'}
              </p>
            </div>

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
        <footer className="h-14 px-8 bg-surface-container-low flex items-center border-t border-outline-variant">
          <p className="text-[11px] text-on-surface-variant">
            {displayRuns.reduce((n, r) => n + r.approvedCount, 0)} approved outputs across{' '}
            {displayRuns.length} run{displayRuns.length !== 1 ? 's' : ''}
          </p>
        </footer>
      </div>
    </>
  );
}
