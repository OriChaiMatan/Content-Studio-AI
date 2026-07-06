import { useT } from '../../i18n/useT';
import { Icon } from '../../components/ui/Icon';
import type { PodcastEpisodeSummary } from './types';
import type { StringKey } from '../../i18n/strings';

interface Props {
  episode: PodcastEpisodeSummary;
}

function stageKey(episode: PodcastEpisodeSummary): StringKey {
  switch (episode.status) {
    case 'pending':        return 'podcast.stage.pending';
    case 'generating':     return 'podcast.stage.generating';
    case 'pack_ready':     return 'podcast.stage.pack_ready';
    case 'blueprint_ready':
      return episode.sectionsCompleted === 0 ? 'podcast.stage.intro' : 'podcast.stage.blueprint_ready';
    case 'critique_ready': return 'podcast.stage.critique_ready';
    default:               return 'podcast.stage.pending';
  }
}

function episodeTypeLabel(density: string): string | null {
  switch (density) {
    case 'high':    return 'podcast.meta.deepDive';
    case 'medium':  return 'podcast.meta.standardEpisode';
    case 'limited': return 'podcast.meta.shortBriefing';
    default:        return null;
  }
}

export function PodcastGenerating({ episode }: Props) {
  const { t } = useT();
  const key = stageKey(episode);
  const msg = key === 'podcast.stage.blueprint_ready' && episode.sectionsCompleted > 0
    ? t('podcast.stage.writing_section', { n: episode.sectionsCompleted + 1 })
    : t(key);

  // Contextual metadata — only shown once available
  const episodeTypeKey = episodeTypeLabel(episode.researchDensity);
  const hasTitle = Boolean(episode.title);
  const hasDuration = episode.estimatedDurationMin > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-[400px] bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
        {/* Animated progress stripe */}
        <div className="h-1.5 relative overflow-hidden bg-surface-container">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-primary/30 via-primary to-primary/30 animate-[shimmer_1.8s_ease-in-out_infinite]" />
        </div>

        <div className="p-8 flex flex-col items-center gap-5 text-center">
          {/* Pulsing icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="mic" className="text-primary" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-primary/70" />
            </span>
          </div>

          {/* Stage message */}
          <div className="space-y-2">
            <p className="text-[17px] font-semibold text-on-surface" dir="auto">{msg}</p>
            {hasTitle && (
              <p className="text-[14px] font-medium text-primary/80 leading-snug" dir="auto">
                {episode.title}
              </p>
            )}
            <p className="text-[13px] text-on-surface-variant leading-relaxed max-w-[300px]">
              {t('podcast.generating.note')}
            </p>
          </div>

          {/* Contextual metadata chips — appear as data becomes available */}
          {(episodeTypeKey || hasDuration) && (
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {episodeTypeKey && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/8 text-primary text-[12px] font-medium">
                  <Icon name="podcasts" size="sm" />
                  {t(episodeTypeKey as StringKey)}
                </span>
              )}
              {hasDuration && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">
                  <Icon name="schedule" size="sm" />
                  {t('podcast.generating.estimatedMin', { min: episode.estimatedDurationMin })}
                </span>
              )}
            </div>
          )}

          {/* Bouncing dots */}
          <div className="flex gap-1.5 mt-1">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
