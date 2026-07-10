import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Button } from './Button';
import { useQuotaModalStore } from '../../stores/quotaModalStore';
import { useComingSoonModalStore } from '../../stores/comingSoonModalStore';
import { useT } from '../../i18n/useT';

const SUPPORT_EMAIL = 'ori.chaimatan@gmail.com';

const KIND_META: Record<string, { title: string; icon: string }> = {
  CASE_LIMIT:        { title: 'Active case limit reached', icon: 'folder_open' },
  SOURCE_ADDED:      { title: 'Source limit reached', icon: 'article' },
  PIPELINE_RUN:      { title: 'Pipeline run limit reached', icon: 'auto_awesome' },
  IMAGE_GENERATION:  { title: 'Image generation limit reached', icon: 'image' },
  PLAN_NOT_USABLE:   { title: 'Account not usable', icon: 'lock' },
};

// Global modal — mounted once in AppLayout. THE primary UX for a reached plan
// limit: action buttons stay clickable, and clicking one that's known (or
// discovered) to be exhausted opens this instead of a hard-disabled button.
// A modal is a single slot, not a stacking list, so it can safely be opened
// from both a proactive pre-check and the reactive 'quota:exceeded' bridge
// (stores/authStore.ts) without ever showing "duplicate" messages.
export function QuotaLimitModal() {
  const content = useQuotaModalStore(s => s.content);
  const close = useQuotaModalStore(s => s.close);
  const showComingSoon = useComingSoonModalStore(s => s.show);
  const navigate = useNavigate();
  const { formatDateTime } = useT();

  // Escape key closes, like any modal.
  useEffect(() => {
    if (!content) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [content, close]);

  if (!content) return null;

  const meta = KIND_META[content.kind] ?? { title: 'Limit reached', icon: 'workspace_premium' };
  const isSuspended = content.kind === 'PLAN_NOT_USABLE';
  const hasUsage = content.used !== undefined && content.limit !== undefined;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quota-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isSuspended ? 'bg-error-container' : 'bg-secondary-container'}`}>
              <Icon name={meta.icon} className={isSuspended ? 'text-error' : 'text-secondary'} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="quota-modal-title" className="text-[17px] font-semibold text-on-surface leading-tight">
                {meta.title}
              </h2>
              <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">
                {content.message ?? "You've reached your plan's limit for this cycle."}
              </p>
            </div>
          </div>

          {hasUsage && (
            <div className="rounded-xl bg-surface-container-low px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-[13px] text-on-surface-variant">{content.label}</span>
              <span className="text-[15px] font-bold text-on-surface">{content.used} / {content.limit}</span>
            </div>
          )}

          {content.resetAt && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-on-surface-variant mb-5">
              <Icon name="event_repeat" size="sm" className="text-outline" />
              Resets {formatDateTime(content.resetAt)}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                if (isSuspended) {
                  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('LumAI account issue')}`;
                  return;
                }
                // No purchasable Pro plan yet — the shared Coming Soon modal is
                // the one place this leads to, everywhere in the product.
                close();
                showComingSoon();
              }}
            >
              <Icon name={isSuspended ? 'support_agent' : 'rocket_launch'} size="sm" />
              {isSuspended ? 'Contact support' : 'Upgrade to Pro'}
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => { close(); navigate('/settings'); }}
            >
              <Icon name="workspace_premium" size="sm" />
              View Plan & Usage
            </Button>
            <Button variant="ghost" fullWidth onClick={close}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
