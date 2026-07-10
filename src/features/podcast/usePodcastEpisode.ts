import { useState, useEffect, useCallback, useRef } from 'react';
import { podcastApi } from './api';
import { isQuotaApiError } from '../../lib/api';
import { useMetricLimitContent } from '../../hooks/useQuotaGate';
import { useQuotaModalStore } from '../../stores/quotaModalStore';
import type { PodcastEpisodeSummary, PodcastEpisodeFull } from './types';

const TERMINAL: PodcastEpisodeStatus[] = ['completed', 'failed'];
type PodcastEpisodeStatus = PodcastEpisodeSummary['status'];

export function usePodcastEpisode(caseId: string, pipelineRunId: string | null, autoStart = false) {
  const [summaries, setSummaries] = useState<PodcastEpisodeSummary[]>([]);
  const [fullEpisode, setFullEpisode] = useState<PodcastEpisodeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoStart = useRef(false);
  // Only /regenerate still charges a PIPELINE_RUN unit — the initial episode
  // is generated as part of the pipeline run that already paid for it (see
  // backend/src/services/pipelineService.ts's content_creation branch).
  const regenerateLimitContent = useMetricLimitContent('PIPELINE_RUN');
  const showQuotaModal = useQuotaModalStore(s => s.show);

  // Most recent episode for this pipeline run (highest version wins)
  const episodeForRun = pipelineRunId
    ? summaries
        .filter(e => e.pipelineRunId === pipelineRunId)
        .sort((a, b) => b.version - a.version)[0] ?? null
    : null;

  const isTerminal = !episodeForRun || TERMINAL.includes(episodeForRun.status);

  const refresh = useCallback(async () => {
    if (!caseId) return;
    try {
      const res = await podcastApi.listEpisodes(caseId);
      setSummaries(res.episodes);
    } catch { /* keep last good state */ }
  }, [caseId]);

  // Initial load
  useEffect(() => {
    if (!caseId) { setLoading(false); return; }
    setLoading(true);
    podcastApi.listEpisodes(caseId)
      .then(res => setSummaries(res.episodes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  // Poll every 4 s while a non-terminal episode exists for this run
  useEffect(() => {
    if (!caseId || isTerminal) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [caseId, isTerminal, refresh]);

  // Fetch full episode when status becomes 'completed'
  useEffect(() => {
    if (!caseId || episodeForRun?.status !== 'completed') return;
    podcastApi.getEpisode(caseId, episodeForRun.id)
      .then(setFullEpisode)
      .catch(() => {});
  }, [caseId, episodeForRun?.id, episodeForRun?.status]);

  const startGeneration = useCallback(async () => {
    if (!pipelineRunId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await podcastApi.generate(caseId, pipelineRunId);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start generation';
      setError(msg.includes('missing_pipeline_artifacts')
        ? 'The pipeline must complete fully before generating a podcast.'
        : msg);
    } finally {
      setGenerating(false);
    }
  }, [caseId, pipelineRunId, generating, refresh]);

  // Auto-start: fire once after initial load completes and no episode exists
  useEffect(() => {
    if (!autoStart || loading || !pipelineRunId || episodeForRun !== null || didAutoStart.current) return;
    didAutoStart.current = true;
    startGeneration();
  }, [autoStart, loading, pipelineRunId, episodeForRun, startGeneration]);

  async function regenerate() {
    if (!episodeForRun || regenerating) return;
    // Proactive: known-fresh usage says the limit is reached — open the modal
    // instead of sending a request we already know will be rejected.
    if (regenerateLimitContent) { showQuotaModal(regenerateLimitContent); return; }
    setRegenerating(true);
    setError(null);
    setFullEpisode(null);
    try {
      await podcastApi.regenerate(caseId, episodeForRun.id);
      await refresh();
    } catch (err) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge already opened the same modal; skip the banner.
      if (isQuotaApiError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  }

  return {
    episode: episodeForRun,
    fullEpisode: episodeForRun?.status === 'completed' ? fullEpisode : null,
    loading,
    generating,
    regenerating,
    error,
    startGeneration,
    regenerate,
    clearError: () => setError(null),
  };
}
