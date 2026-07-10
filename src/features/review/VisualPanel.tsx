import { type Ref } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import type { UseVisual, VisualStatus } from './useVisual';

// Presentational Visual section. State is owned by useVisual (shared with the
// header action button). Large premium card directly under the post. No prompt UI,
// no settings, no provider logic here. Generation happens ONLY from this card's CTA.
const STATUS_LABEL: Record<VisualStatus, string> = {
  idle: 'Not generated yet',
  pending: 'Queued…',
  generating: 'Generating cinematic background…',
  rendering: 'Rendering overlay…',
  ready: 'Ready',
  failed: 'Unavailable',
};

export function VisualPanel({ platform, visual, sectionRef, isArchived }: { platform: 'linkedin' | 'facebook'; visual: UseVisual; sectionRef?: Ref<HTMLElement>; isArchived?: boolean }) {
  const { asset, busy, error, isActive, isReady, isFailed, generate, regenerate } = visual;
  const disabled = busy || isArchived;

  return (
    <section ref={sectionRef} className="border-t border-outline-variant/30 pt-5 sm:pt-6 scroll-mt-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="image" size="sm" className="text-primary shrink-0" />
          <h3 className="text-[15px] font-semibold text-on-surface">Visual</h3>
          <span className="hidden sm:inline text-[12px] text-on-surface-variant truncate">AI background + LumAI overlay</span>
        </div>
        {isReady && (
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" onClick={regenerate} loading={busy}
              disabled={disabled}
              title="Regenerate background"
            >
              <Icon name="refresh" size="sm" />
              <span className="hidden sm:inline">Regenerate Background</span>
            </Button>
            <a href={asset.finalUrl ?? '#'} download={`lumai-${platform}.png`}
               className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-outline text-on-surface hover:bg-surface-variant/40 transition-colors">
              <Icon name="download" size="sm" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        )}
      </div>

      {/* Prominent preview frame — fluid width, fixed 1.91:1 aspect (scales with the
          screen, never an oversized fixed height). */}
      <div className="relative w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low overflow-hidden shadow-sm" style={{ aspectRatio: '1200 / 627' }}>
        {isReady ? (
          <img src={asset.finalUrl ?? ''} alt="Generated visual" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6 gap-2.5 sm:gap-3">
            {asset.status === 'idle' && (
              <>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center"><Icon name="auto_awesome" size="lg" className="text-primary" /></div>
                <p className="text-[14px] font-medium text-on-surface">Create a visual for this post</p>
                <p className="text-[12.5px] text-on-surface-variant max-w-xs">AI background with LumAI-rendered headline.</p>
                <Button size="md" onClick={generate} loading={busy} disabled={disabled}>
                  <Icon name="auto_awesome" size="sm" /> Generate Visual
                </Button>
              </>
            )}
            {isActive && (
              <>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-[13.5px] font-medium text-on-surface px-2">{STATUS_LABEL[asset.status]}</p>
                <p className="text-[12px] text-on-surface-variant">This can take 30–50 seconds.</p>
              </>
            )}
            {isFailed && (
              <>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100 flex items-center justify-center"><Icon name="image_not_supported" size="lg" className="text-amber-700" /></div>
                <p className="text-[13.5px] font-medium text-on-surface px-2">Visual generation is currently unavailable</p>
                <p className="text-[12px] text-on-surface-variant max-w-xs">{asset.errorMessage || 'Please try again shortly.'}</p>
                <Button size="sm" variant="outline" onClick={generate} loading={busy} disabled={disabled}>
                  <Icon name="refresh" size="sm" /> Try again
                </Button>
              </>
            )}
          </div>
        )}

        {/* Trigger error — kept INSIDE the card so it never looks disconnected. */}
        {error && (
          <div className="absolute bottom-0 inset-x-0 bg-error-container/90 px-3 py-2 text-[12px] text-on-error-container text-center">{error}</div>
        )}
      </div>
    </section>
  );
}
