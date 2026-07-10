import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { useArchiveConfirmModalStore } from '../../stores/archiveConfirmModalStore';
import { useContentCasesStore } from '../../stores/contentCasesStore';

const PRESERVED = ['Sources', 'Pipeline history', 'Outputs', 'Images', 'Podcast', 'Library'];

// The one confirmation step for archiving a case — reused from both the
// "at active limit, archive to continue" flow and the Case Detail page's own
// "Archive this case" action. Archiving is explicit and user-initiated only;
// this dialog is the single place that action is ever confirmed.
export function ArchiveConfirmModal() {
  const content = useArchiveConfirmModalStore(s => s.content);
  const close = useArchiveConfirmModalStore(s => s.close);
  const archiveCase = useContentCasesStore(s => s.archiveCase);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !archiving) close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, close]);

  if (!content) return null;

  async function handleArchive() {
    setArchiving(true);
    setError(null);
    try {
      await archiveCase(content!.caseId);
      const onArchived = content!.onArchived;
      close();
      onArchived?.();
    } catch {
      setError('Failed to archive the case. Please try again.');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      onClick={() => !archiving && close()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-confirm-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
              <Icon name="archive" className="text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="archive-confirm-modal-title" className="text-[17px] font-semibold text-on-surface leading-tight">
                Archive this case?
              </h2>
              <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">
                Nothing will be deleted. All sources, outputs, images, podcast content, and history will remain available. You can reactivate this case later.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low px-4 py-3 mb-4">
            <ul className="space-y-1.5">
              {PRESERVED.map(item => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-on-surface">
                  <Icon name="check" size="sm" className="text-secondary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-[12.5px] text-error mb-4">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={handleArchive} loading={archiving} disabled={archiving}>
              <Icon name="archive" size="sm" />
              {archiving ? 'Archiving…' : 'Archive Case'}
            </Button>
            <Button variant="ghost" fullWidth onClick={close} disabled={archiving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
