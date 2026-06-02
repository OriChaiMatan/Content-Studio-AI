import { TopBar } from '../../components/layout/TopBar';
import { PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useLibraryStore } from '../../stores/libraryStore';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { Platform, OutputStatus } from '../../types';

const PLATFORM_OPTIONS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all',          label: 'All Types' },
  { value: 'linkedin',     label: 'LinkedIn' },
  { value: 'facebook',     label: 'Facebook' },
  { value: 'instagram',    label: 'Instagram' },
  { value: 'newsletter',   label: 'Newsletter' },
  { value: 'podcast',      label: 'Podcast' },
  { value: 'image_prompt', label: 'Image Prompt' },
];

const STATUS_OPTIONS: { value: OutputStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'All Status' },
  { value: 'draft',    label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Green bar = approved, grey = draft/rejected
function statusBarClass(status: OutputStatus) {
  return status === 'approved'
    ? 'border-l-4 border-green-400'
    : 'border-l-4 border-slate-300';
}

export function LibraryPage() {
  const { filters, viewMode, setFilter, setViewMode, filteredItems } = useLibraryStore();
  const cases = useContentCasesStore(s => s.cases);
  const items = filteredItems();

  const caseOptions = [
    { value: 'all', label: 'All Cases' },
    ...cases.map(c => ({ value: c.id, label: c.title })),
  ];

  return (
    <>
      <TopBar
        title="Library"
        searchPlaceholder="Search approved content..."
        onSearch={q => setFilter('query', q)}
      />

      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 bg-surface">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            {/* Case filter */}
            <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-lg border border-outline-variant">
              <span className="text-[14px] font-medium">Filter by Case:</span>
              <select
                value={filters.caseId}
                onChange={e => setFilter('caseId', e.target.value)}
                className="bg-transparent border-none text-[14px] font-sans pr-4 cursor-pointer"
              >
                {caseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Platform filter */}
            <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-lg border border-outline-variant">
              <span className="text-[14px] font-medium">Content Type:</span>
              <select
                value={filters.platform}
                onChange={e => setFilter('platform', e.target.value as Platform | 'all')}
                className="bg-transparent border-none text-[14px] font-sans pr-4 cursor-pointer"
              >
                {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-lg border border-outline-variant">
              <span className="text-[14px] font-medium">Status:</span>
              <select
                value={filters.status}
                onChange={e => setFilter('status', e.target.value as OutputStatus | 'all')}
                className="bg-transparent border-none text-[14px] font-sans pr-4 cursor-pointer"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* View mode */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-variant/50'}`}
              >
                <Icon name="grid_view" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-variant/50'}`}
              >
                <Icon name="list" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'flex flex-col gap-3'
          }>
            {items.map(item => (
              <div
                key={item.id}
                className={`group bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 transition-all border border-outline-variant/30 hover:-translate-y-0.5 hover:shadow-md ${statusBarClass(item.status)}`}
              >
                <div className="flex justify-between items-start">
                  <PlatformBadge platform={item.platform} />
                  <OutputStatusBadge status={item.status} />
                </div>

                <div>
                  <h3 className="text-[16px] font-medium text-on-surface mb-1">{item.title}</h3>
                  <p className="text-[14px] text-on-surface-variant line-clamp-2">{item.body}</p>
                </div>

                <div className="mt-auto pt-4 border-t border-outline-variant flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-outline tracking-wider">Case</span>
                    <span className="text-[14px] font-medium">{item.contentCaseName}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase font-bold text-outline tracking-wider">{item.version}</span>
                    <span className="text-[11px] text-on-surface-variant/60">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs flex items-center justify-center gap-1">
                    <Icon name="open_in_new" size="sm" />
                    Open
                  </button>
                  <button className="px-3 py-2 border border-outline rounded-lg text-xs font-bold hover:bg-surface-variant/30 transition-colors">
                    <Icon name="content_copy" size="sm" />
                  </button>
                  <button className="px-3 py-2 border border-outline rounded-lg text-xs font-bold hover:bg-surface-variant/30 transition-colors">
                    <Icon name="ios_share" size="sm" />
                  </button>
                </div>
              </div>
            ))}

            {/* Empty state / add card */}
            <div className="border-2 border-dashed border-outline-variant rounded-xl p-4 flex flex-col items-center justify-center gap-4 hover:bg-surface-container/50 cursor-pointer transition-colors min-h-[220px]">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <Icon name="note_add" size="lg" />
              </div>
              <p className="text-[14px] font-medium text-outline">Add Content to Library</p>
            </div>
          </div>
        </div>

        {/* Pagination footer */}
        <footer className="h-16 px-8 bg-surface-container-low flex items-center justify-between border-t border-outline-variant shrink-0">
          <p className="text-[11px] text-on-surface-variant">
            Showing 1–{items.length} of {items.length} items
          </p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant transition-colors opacity-30" disabled>
              <Icon name="chevron_left" size="sm" />
            </button>
            <button className="w-8 h-8 rounded-full bg-primary text-on-primary text-xs font-bold">1</button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant transition-colors">
              <Icon name="chevron_right" size="sm" />
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
