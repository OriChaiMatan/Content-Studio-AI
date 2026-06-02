import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/TopBar';
import { CaseStatusBadge, PlatformBadge, OutputStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Platform, ContentOutput } from '../../types';

const PLATFORM_ORDER: Platform[] = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt'];

const platformIcon: Record<Platform, string> = {
  linkedin:     'work',
  facebook:     'groups',
  instagram:    'photo_camera',
  newsletter:   'email',
  podcast:      'mic',
  image_prompt: 'image',
};

// ── Score pill ─────────────────────────────────────────────

function ScorePill({ label, value, icon }: { label: string; value: number; icon: string }) {
  const color = value >= 90 ? 'text-green-700 bg-green-100' : value >= 75 ? 'text-primary bg-primary-fixed/50' : 'text-outline bg-surface-container';
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${color}`}>
      <Icon name={icon} size="sm" />
      <span>{label}: {value}%</span>
    </div>
  );
}

// ── Output card ────────────────────────────────────────────

interface OutputCardProps {
  output: ContentOutput;
  caseId: string;
  caseName: string;
  isActive: boolean;
  onSelect: () => void;
}

function OutputCard({ output, caseId, caseName, isActive, onSelect }: OutputCardProps) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(output.body);

  // Keep local edit state in sync when the store updates (e.g. after Regenerate)
  useEffect(() => {
    setBody(output.body);
    setEditing(false);
  }, [output.body]);
  const { updateOutputStatus, updateOutputBody, regenerateOutput } = useContentCasesStore();
  const addLibraryItem = useLibraryStore(s => s.addItem);

  function handleApprove() {
    updateOutputStatus(caseId, output.id, 'approved');
    // Sync to library
    addLibraryItem({
      id: `lib-${output.id}`,
      contentCaseId: caseId,
      contentCaseName: caseName,
      outputId: output.id,
      platform: output.platform,
      title: output.title,
      body: output.body,
      status: 'approved',
      version: output.version,
      date: new Date().toISOString(),
    });
    setEditing(false);
  }

  function handleReject() {
    updateOutputStatus(caseId, output.id, 'rejected');
    setEditing(false);
  }

  function handleSaveEdit() {
    updateOutputBody(caseId, output.id, body);
    setEditing(false);
  }

  function handleRegenerate() {
    regenerateOutput(caseId, output.id);
    setEditing(false);
  }

  const statusBorderColor = {
    draft:    'border-l-outline-variant',
    approved: 'border-l-green-400',
    rejected: 'border-l-error',
  }[output.status];

  return (
    <div
      className={`rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm border-l-4 ${statusBorderColor} cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-outline">
            <Icon name={platformIcon[output.platform]} size="sm" />
          </div>
          <PlatformBadge platform={output.platform} />
        </div>
        <OutputStatusBadge status={output.status} />
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <h3 className="text-[15px] font-medium text-on-surface">{output.title}</h3>
      </div>

      {/* Scores */}
      {output.contentScore !== null && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          <ScorePill label="Content"    value={output.contentScore}         icon="star" />
          <ScorePill label="Research"   value={output.researchConfidence!}  icon="search" />
          <ScorePill label="Fact Check" value={output.factCheckAccuracy!}   icon="fact_check" />
        </div>
      )}

      {/* Body — collapsed unless active */}
      <div className="px-5 pb-4">
        {isActive ? (
          editing ? (
            <div onClick={e => e.stopPropagation()}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={12}
                className="w-full bg-surface-container-low border border-primary rounded-lg text-[13px] text-on-surface px-3 py-2 font-sans resize-y focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-[13px] text-on-surface font-sans leading-relaxed max-h-64 overflow-y-auto">
              {output.body}
            </pre>
          )
        ) : (
          <p className="text-[13px] text-on-surface-variant line-clamp-3">{output.body}</p>
        )}
      </div>

      {/* Actions — only when active */}
      {isActive && (
        <div
          className="border-t border-outline-variant/30 px-5 py-3 flex gap-2 flex-wrap"
          onClick={e => e.stopPropagation()}
        >
          {editing ? (
            <>
              <Button size="sm" onClick={handleSaveEdit}>
                <Icon name="save" size="sm" />
                Save Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(output.body); }}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={output.status === 'approved'}>
                <Icon name="edit" size="sm" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={handleRegenerate}>
                <Icon name="refresh" size="sm" />
                Regenerate
              </Button>
              <div className="flex-1" />
              {output.status !== 'rejected' && (
                <Button size="sm" variant="danger" onClick={handleReject}>
                  <Icon name="cancel" size="sm" />
                  Reject
                </Button>
              )}
              {output.status !== 'approved' && (
                <Button size="sm" onClick={handleApprove}>
                  <Icon name="check_circle" size="sm" />
                  Approve
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────

export function ContentCaseReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const caseItem = useContentCasesStore(s => s.getCaseById(id ?? ''));
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');

  if (!caseItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-on-surface-variant">Case not found.</p>
      </div>
    );
  }

  const c = caseItem;
  const approvedCount = c.outputs.filter(o => o.status === 'approved').length;
  const totalCount    = c.outputs.length;

  // Sort outputs by PLATFORM_ORDER
  const sortedOutputs = [...c.outputs].sort((a, b) =>
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
        {/* Sub-header: progress + source context */}
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

          {/* Source count used in this generation */}
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
              {output.status === 'approved' && <Icon name="check_circle" size="sm" className="text-green-600" />}
              {output.status === 'rejected' && <Icon name="cancel" size="sm" className="text-error" />}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-8">
          {c.outputs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Icon name="auto_awesome" size="xl" className="text-outline mb-4" />
              <p className="text-[16px] font-medium text-on-surface-variant">No outputs generated yet.</p>
              <p className="text-[14px] text-outline mt-1">Run the pipeline first to generate content.</p>
              <Button className="mt-6" onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
                Go to Pipeline
              </Button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Active platform: full card */}
              {activeOutput && (
                <OutputCard
                  key={activeOutput.id}
                  output={activeOutput}
                  caseId={c.id}
                  caseName={c.title}
                  isActive
                  onSelect={() => {}}
                />
              )}

              {/* Other platforms: compact preview */}
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
                          caseName={c.title}
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
