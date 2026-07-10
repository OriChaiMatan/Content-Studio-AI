import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Button } from './Button';
import { useActiveCaseLimitModalStore, type CaseLimitInfo } from '../../stores/activeCaseLimitModalStore';
import { useArchiveConfirmModalStore } from '../../stores/archiveConfirmModalStore';
import { useComingSoonModalStore } from '../../stores/comingSoonModalStore';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import { useT } from '../../i18n/useT';

function CaseInfoBlock({ label, info, formatDateTime }: { label: string; info: CaseLimitInfo; formatDateTime: (iso: string) => string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-4 py-3">
      <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-[14px] font-semibold text-on-surface truncate mb-2">{info.title}</p>
      <div className="grid grid-cols-2 gap-y-1.5 text-[12.5px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <Icon name="event_repeat" size="sm" className="text-outline" />
          Updated {formatDateTime(info.updatedAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="article" size="sm" className="text-outline" />
          {info.sourceCount} source{info.sourceCount === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="auto_awesome" size="sm" className="text-outline" />
          {info.pipelineRunCount} pipeline run{info.pipelineRunCount === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="description" size="sm" className="text-outline" />
          {info.outputCount} output{info.outputCount === 1 ? '' : 's'} generated
        </span>
      </div>
    </div>
  );
}

// Shown instead of the generic QuotaLimitModal specifically when the reason is
// "at active-case limit" — from two flows (see hooks/useQuotaGate.ts and the
// Case Detail page's Reactivate action). Free plan allows unlimited ARCHIVED
// cases, only one ACTIVE case at a time; this modal shows real case data so
// the archive/reactivate decision is informed, not blind.
export function ActiveCaseLimitModal() {
  const content = useActiveCaseLimitModalStore(s => s.content);
  const close = useActiveCaseLimitModalStore(s => s.close);
  const showArchiveConfirm = useArchiveConfirmModalStore(s => s.show);
  const showComingSoon = useComingSoonModalStore(s => s.show);
  const reactivateCase = useContentCasesStore(s => s.reactivateCase);
  const navigate = useNavigate();
  const { formatDateTime } = useT();
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !reactivating) close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, close]);

  if (!content) return null;

  function archiveAndCreate() {
    close();
    showArchiveConfirm({
      caseId: content!.activeCase.caseId,
      onArchived: () => navigate('/cases/new'),
    });
  }

  async function archiveAndReactivate() {
    setReactivating(true);
    setError(null);
    try {
      await reactivateCase(content!.targetCase!.caseId, content!.activeCase.caseId);
      close();
    } catch {
      setError('Could not complete this action. Please try again.');
    } finally {
      setReactivating(false);
    }
  }

  function learnAboutPro() {
    close();
    showComingSoon();
  }

  const isReactivate = content.mode === 'reactivate';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      onClick={() => !reactivating && close()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-case-limit-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
              <Icon name="folder_open" className="text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="active-case-limit-modal-title" className="text-[17px] font-semibold text-on-surface leading-tight">
                You already have an active Content Case
              </h2>
              <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">
                {isReactivate
                  ? 'Your Free plan allows one active Content Case at a time. Archive your current case to reactivate this one instead.'
                  : 'Your Free plan allows one active Content Case at a time. Archive your current case to begin working on a new topic.'}
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-5">
            <CaseInfoBlock label={isReactivate ? 'Currently active' : 'Active case'} info={content.activeCase} formatDateTime={formatDateTime} />
            {isReactivate && content.targetCase && (
              <CaseInfoBlock label="Case to reactivate" info={content.targetCase} formatDateTime={formatDateTime} />
            )}
          </div>

          {error && (
            <p className="text-[12.5px] text-error mb-4">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            {isReactivate ? (
              <Button fullWidth onClick={archiveAndReactivate} loading={reactivating} disabled={reactivating}>
                <Icon name="archive" size="sm" />
                Archive current case and reactivate this one
              </Button>
            ) : (
              <Button fullWidth onClick={archiveAndCreate}>
                <Icon name="archive" size="sm" />
                Archive &amp; Create New
              </Button>
            )}
            <Button variant="outline" fullWidth onClick={learnAboutPro} disabled={reactivating}>
              <Icon name="rocket_launch" size="sm" />
              Learn about LumAI Pro
            </Button>
            <Button variant="ghost" fullWidth onClick={close} disabled={reactivating}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
