import { api } from '../../lib/api';
import type { PodcastEpisodeSummary, PodcastEpisodeFull } from './types';

export const podcastApi = {
  listEpisodes: (caseId: string) =>
    api.get<{ episodes: PodcastEpisodeSummary[] }>(`/cases/${caseId}/podcast/episodes`),

  getEpisode: (caseId: string, episodeId: string) =>
    api.get<PodcastEpisodeFull>(`/cases/${caseId}/podcast/episodes/${episodeId}`),

  generate: (caseId: string, pipelineRunId: string) =>
    api.post<{ accepted: boolean; episodeId: string; status: string }>(
      `/cases/${caseId}/podcast/episodes`,
      { pipelineRunId },
    ),

  regenerate: (caseId: string, episodeId: string) =>
    api.post<{ accepted: boolean; episodeId: string; version: number; status: string }>(
      `/cases/${caseId}/podcast/episodes/${episodeId}/regenerate`,
      {},
    ),
};
