import { useState } from 'react';
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
import type { ContentGoal, ContentStyle, ContentTarget, Language, ContentCase } from '../../types';

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
  linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram',
  newsletter: 'Newsletter', podcast: 'Podcast', images: 'Images',
};

const TARGET_ICONS: Record<ContentTarget, string> = {
  linkedin: 'work', facebook: 'groups', instagram: 'photo_camera',
  newsletter: 'email', podcast: 'mic', images: 'image',
};

export function ContentCaseDetail() {
  // ── ALL hooks must be called unconditionally before any early return ──────────

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Live, auto-refreshing case (same pattern as the pipeline page — polls GET
  // /cases/:id every 5s so scheduled runs, step progress, completion, and new
  // WhatsApp sources show without a manual refresh). The hook also seeds the store
  // on mount, so the previous one-shot fetchCaseById effect is no longer needed.
  const caseItem      = useLiveCase(id);
  const loading       = useContentCasesStore(s => s.loading);
  const refreshCase   = useContentCasesStore(s => s.refreshCase);
  const deleteCase    = useContentCasesStore(s => s.deleteCase);

  // Local state
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);

  // ── Early return — safe now that all hooks are above ─────────────────────────
  if (!caseItem) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-on-surface-variant">
        {loading
          ? <><span className="material-symbols-outlined animate-spin">refresh</span><span className="text-[14px]">Loading…</span></>
          : <p className="text-[14px]">Case not found.</p>
        }
      </div>
    );
  }

  const c = caseItem;
  const canReview = c.status === 'in_review' || c.status === 'completed';

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

  return (
    <>
      <TopBar
        title={c.title}
        actions={
          <div className="flex items-center gap-2">
            {/* Delete confirmation inline in header */}
            {confirmDelete ? (
              <div className="flex items-center gap-2 bg-error-container/60 border border-error/20 rounded-xl px-3 py-1.5">
                <span className="text-[12px] text-error font-medium">Delete this case?</span>
                <Button variant="danger" size="sm" onClick={handleDeleteCase} loading={deleting} disabled={deleting}>
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
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
              <Icon name={c.status === 'draft' ? 'play_arrow' : 'schema'} size="sm" />
              {c.status === 'draft' ? 'Start Pipeline' : 'Pipeline'}
            </Button>
            {canReview && (
              <Button size="sm" onClick={() => navigate(`/cases/${c.id}/review`)}>
                <Icon name="rate_review" size="sm" />
                Review Outputs
              </Button>
            )}
          </div>
        }
      />

      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {deleteError && (
          <div className="flex items-center gap-3 bg-error-container/60 border border-error/20 rounded-xl px-4 py-3">
            <Icon name="error" className="text-error shrink-0" size="sm" />
            <p className="text-[13px] text-on-error-container">{deleteError}</p>
          </div>
        )}

        {/* ── Header card ─────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-sm flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CaseStatusBadge status={c.status} />
              <span className="text-[12px] text-on-surface-variant uppercase font-bold tracking-wider">{c.language}</span>
            </div>
            <h2 className="text-[28px] font-serif text-on-surface mb-1">{c.title}</h2>
            <p className="text-[14px] text-on-surface-variant">{c.targetAudience}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-[11px] text-on-surface-variant">
              Created {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Updated {new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-1 text-[12px] text-on-surface-variant">
              <Icon name="schedule" size="sm" className="text-outline" />
              <span className="capitalize">{c.schedule.frequency}</span>
              {c.schedule.time && <span>at {c.schedule.time}</span>}
            </div>
          </div>
        </div>

        {/* ── 2-column: config + outputs/pipeline ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Case Settings */}
          <div className="lg:col-span-2 space-y-5">

            {/* ── Case Settings (new wizard fields) ────────────── */}
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

            {/* Legacy: show only if case has old-wizard data */}
            {(c.targetAudience || c.industry) && (
              <Card accent className="p-5">
                <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Icon name="groups" className="text-outline" size="sm" />
                  Audience
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {c.targetAudience && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">Target</p><p className="text-[14px] text-on-surface mt-1">{c.targetAudience}</p></div>}
                  {c.industry && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">Industry</p><p className="text-[14px] text-on-surface mt-1">{c.industry}</p></div>}
                  {c.experienceLevel && <div><p className="text-[11px] text-outline uppercase font-bold tracking-wider">Level</p><p className="text-[14px] text-on-surface mt-1 capitalize">{c.experienceLevel}</p></div>}
                </div>
              </Card>
            )}
            {(c.writingStyle || c.goals) && (
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

          {/* Right: Outputs + Pipeline */}
          <div className="space-y-4">
            <Card className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="auto_awesome" className="text-outline" size="sm" />
                Outputs
              </h4>
              {(() => {
                // Only show outputs from the current (most recent) run.
                // Outputs from older runs are preserved in DB but shown via the Library.
                const currentRunId = c.currentRun?.id;
                const currentOutputs = currentRunId
                  ? c.outputs.filter(o => o.pipelineRunId === currentRunId)
                  : c.outputs;
                return currentOutputs.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center gap-2">
                  <Icon name="pending" size="xl" className="text-outline" />
                  <p className="text-[13px] text-on-surface-variant">
                    {c.status === 'draft'
                      ? 'Add sources below, then start the pipeline.'
                      : 'Pipeline is running — outputs will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentOutputs.map(output => (
                    <div key={output.id} className="flex items-center gap-2 py-2 border-b border-outline-variant/20 last:border-0">
                      <PlatformBadge platform={output.platform} />
                      <div className="flex-1" />
                      <OutputStatusBadge status={output.status} />
                    </div>
                  ))}
                  {canReview && (
                    <Button fullWidth className="mt-3" onClick={() => navigate(`/cases/${c.id}/review`)}>
                      <Icon name="rate_review" size="sm" />
                      Review All
                    </Button>
                  )}
                </div>
              );
              })()}
            </Card>

            <Card className="p-5">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <Icon name="schema" className="text-outline" size="sm" />
                Pipeline
              </h4>
              {/* Source lifecycle summary */}
              {(() => {
                const newCount  = c.sources.filter(s => s.status === 'new').length;
                const usedCount = c.sources.filter(s => s.status === 'used').length;
                const noNew = c.sources.length > 0 && newCount === 0;
                return (
                  <div className={[
                    'flex items-center gap-2 mb-3 text-[12px] rounded-lg px-3 py-2',
                    noNew ? 'bg-surface-container-high text-on-surface-variant' : 'bg-surface-container-low text-on-surface-variant',
                  ].join(' ')}>
                    <Icon name="article" size="sm" className={noNew ? 'text-outline' : 'text-primary'} />
                    {c.sources.length === 0 ? (
                      <span>No sources yet</span>
                    ) : (
                      <span>
                        <span className="font-bold text-primary">{newCount} new</span>
                        {usedCount > 0 && <> · <span className="font-bold">{usedCount} used</span></>}
                        {noNew && <span className="text-outline"> — add new sources to run again</span>}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="space-y-2 mb-4">
                {c.pipeline.map(step => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={[
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                      step.status === 'completed' ? 'bg-primary text-on-primary' :
                      step.status === 'running'   ? 'bg-secondary-container text-on-secondary-container' :
                      'bg-surface-container text-outline',
                    ].join(' ')}>
                      {step.status === 'completed' ? (
                        <Icon name="check" size="sm" />
                      ) : step.status === 'running' ? (
                        <span className="material-symbols-outlined text-xs animate-spin">refresh</span>
                      ) : (
                        <Icon name="circle" size="sm" />
                      )}
                    </div>
                    <p className={`text-[13px] capitalize ${step.status === 'idle' ? 'text-outline' : 'text-on-surface'}`}>
                      {step.name.replace('_', ' ')}
                    </p>
                    {step.confidence !== null && (
                      <span className="ml-auto text-[11px] text-primary font-bold">{step.confidence}%</span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" fullWidth onClick={() => navigate(`/cases/${c.id}/pipeline`)}>
                {c.status === 'draft' ? 'Start Pipeline' : 'View Pipeline'}
              </Button>
            </Card>
          </div>
        </div>

        {/* ── Content Sources workspace (full width) ───── */}
        <SourcesPanel caseId={c.id} />

      </main>
    </>
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
  onSave: (updates: Partial<ContentCase>) => Promise<void>;
}

function CaseSettingsCard({ c, editing, saving, onEdit, onCancel, onSave }: CaseSettingsCardProps) {
  const [goal,    setGoal]    = useState<ContentGoal>(c.contentGoal);
  const [style,   setStyle]   = useState<ContentStyle>(c.contentStyle);
  const [lang,    setLang]    = useState<Language>(c.language);
  const [targets, setTargets] = useState<ContentTarget[]>(c.contentTargets);

  function toggleTarget(t: ContentTarget) {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  const allTargets: { value: ContentTarget; icon: string }[] = [
    { value: 'linkedin', icon: 'work' }, { value: 'facebook', icon: 'groups' },
    { value: 'instagram', icon: 'photo_camera' }, { value: 'newsletter', icon: 'email' },
    { value: 'podcast', icon: 'mic' }, { value: 'images', icon: 'image' },
  ];

  function handleEdit() {
    setGoal(c.contentGoal); setStyle(c.contentStyle);
    setLang(c.language);    setTargets(c.contentTargets);
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

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => onSave({ contentGoal: goal, contentStyle: style, language: lang, contentTargets: targets })}
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
