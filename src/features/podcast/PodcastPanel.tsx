import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { useT } from '../../i18n/useT';
import { PodcastGenerating } from './PodcastGenerating';
import { PodcastEpisodeView } from './PodcastEpisodeView';
import { PodcastErrorBoundary } from './PodcastErrorBoundary';
import { usePodcastEpisode } from './usePodcastEpisode';
import type { PodcastEpisodeFull } from './types';

interface Props {
  caseId: string;
  pipelineRunId: string | null;
  autoStart?: boolean;
}

// Returns true when the episode has enough data to render PodcastEpisodeView.
// Guards against completed episodes that are missing narration sections.
function isRenderable(full: PodcastEpisodeFull): boolean {
  return Array.isArray(full.sections) && (full.sections as unknown[]).length > 0;
}

// Count sources from the researchPack (sourceRefs field — matches backend ResearchPack shape).
function countSources(full: PodcastEpisodeFull): number {
  const pack = full.researchPack as Record<string, unknown> | null;
  if (!pack) return 0;
  if (Array.isArray(pack.sourceRefs)) return (pack.sourceRefs as unknown[]).length;
  return 0;
}

export function PodcastPanel({ caseId, pipelineRunId, autoStart = false }: Props) {
  const { t } = useT();
  const {
    episode,
    fullEpisode,
    loading,
    generating,
    regenerating,
    error,
    startGeneration,
    regenerate,
    clearError,
  } = usePodcastEpisode(caseId, pipelineRunId, autoStart);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-2.5 text-on-surface-variant text-[14px]">
          <span className="animate-spin rounded-full h-5 w-5 border-2 border-outline border-t-primary" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

  // ── Error banner (dismissible) ────────────────────────────────────────────
  const errorBanner = error && (
    <div className="shrink-0 flex items-start gap-2.5 bg-error-container/30 border border-error/20 text-on-error-container rounded-xl mx-4 mt-4 px-4 py-3 text-[13px]">
      <Icon name="error" size="sm" className="shrink-0 mt-0.5 text-error" />
      <span className="flex-1 leading-relaxed" dir="auto">{error}</span>
      <button onClick={clearError} className="shrink-0 text-error hover:text-on-error-container transition-colors">
        <Icon name="close" size="sm" />
      </button>
    </div>
  );

  // ── Not started ───────────────────────────────────────────────────────────
  if (!episode) {
    // When auto-start is enabled and there's no error, generation is imminent/underway —
    // show a spinner rather than the Generate button so the user never has to click.
    if (autoStart && !error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <Icon name="mic" className="text-primary animate-pulse" />
          </div>
          <h2 className="text-[18px] font-semibold text-on-surface mb-2">
            {t('podcast.autoStart.preparing')}
          </h2>
          <p className="text-[13px] text-on-surface-variant max-w-[360px] leading-relaxed">
            {t('podcast.generating.note')}
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        {errorBanner}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <Icon name="mic" className="text-primary" />
          </div>
          <h2 className="text-[20px] font-semibold text-on-surface mb-2">
            {t('podcast.notStarted.title')}
          </h2>
          <p className="text-[14px] text-on-surface-variant mb-7 max-w-[360px] leading-relaxed">
            {t('podcast.wizSubtitle')}
          </p>
          {pipelineRunId ? (
            <Button onClick={startGeneration} loading={generating} disabled={generating}>
              <Icon name="play_arrow" size="sm" />
              {t('podcast.notStarted.generate')}
            </Button>
          ) : (
            <p className="text-[13px] text-outline">{t('podcast.notStarted.noRun')}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Generating / in progress ──────────────────────────────────────────────
  if (episode.status !== 'completed' && episode.status !== 'failed') {
    return (
      <div className="flex-1 flex flex-col">
        {errorBanner}
        <PodcastGenerating episode={episode} />
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (episode.status === 'failed') {
    return (
      <div className="flex-1 flex flex-col">
        {errorBanner}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mb-5">
            <Icon name="error_outline" className="text-error" />
          </div>
          <h2 className="text-[18px] font-semibold text-on-surface mb-2">{t('podcast.failed.title')}</h2>
          {episode.errorMessage && (
            <p className="text-[13px] text-on-surface-variant mb-5 max-w-[360px] leading-relaxed" dir="auto">
              {episode.errorMessage}
            </p>
          )}
          <p className="text-[13px] text-on-surface-variant mb-6 max-w-[380px]">
            {t('podcast.failed.hint')}
          </p>
          <Button onClick={regenerate} loading={regenerating} disabled={regenerating}>
            <Icon name="refresh" size="sm" />
            {t('podcast.failed.retry')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Completed — waiting for full episode to load ──────────────────────────
  if (!fullEpisode) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-2.5 text-on-surface-variant text-[14px]">
          <span className="animate-spin rounded-full h-5 w-5 border-2 border-outline border-t-primary" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

  // ── Completed but malformed — sections missing ────────────────────────────
  if (!isRenderable(fullEpisode)) {
    return (
      <div className="flex-1 flex flex-col">
        {errorBanner}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-5">
            <Icon name="mic_off" className="text-outline" />
          </div>
          <h2 className="text-[18px] font-semibold text-on-surface mb-2">
            Episode is ready, but some display data is missing.
          </h2>
          <p className="text-[13px] text-on-surface-variant mb-6 max-w-[380px]">
            Please regenerate the episode to rebuild the narration sections.
          </p>
          <Button onClick={regenerate} loading={regenerating} disabled={regenerating}>
            <Icon name="refresh" size="sm" />
            {t('podcast.action.regenerate')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Completed and renderable ──────────────────────────────────────────────
  return (
    <PodcastErrorBoundary>
      <PodcastEpisodeView
        full={fullEpisode}
        onRegenerate={regenerate}
        regenerating={regenerating}
        sourceCount={countSources(fullEpisode)}
      />
    </PodcastErrorBoundary>
  );
}
