import { useEffect, useRef, useState, useCallback } from 'react';
import { api, ApiError, isQuotaApiError } from '../../lib/api';
import { useUsageStore } from '../../stores/usageStore';
import { useMetricLimitContent } from '../../hooks/useQuotaGate';
import { useQuotaModalStore } from '../../stores/quotaModalStore';

// Shared Visual Engine state for one output+platform. Owns the fetch + poll +
// generate/regenerate so BOTH the header action button and the VisualPanel render
// from a single source of truth. Inert when platform is null (newsletter etc.).
export type VisualStatus = 'idle' | 'pending' | 'generating' | 'rendering' | 'ready' | 'failed';
export interface VisualAsset {
  id?: string;
  status: VisualStatus;
  platform: string;
  version?: number;
  degraded?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  finalUrl?: string | null;
}

const ACTIVE: VisualStatus[] = ['pending', 'generating', 'rendering'];

export function useVisual(caseId: string, outputId: string, platform: 'linkedin' | 'facebook' | null) {
  const enabled = platform === 'linkedin' || platform === 'facebook';
  const base = `/cases/${caseId}/outputs/${outputId}/visual`;
  const [asset, setAsset] = useState<VisualAsset>({ status: 'idle', platform: platform ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageGenLimitContent = useMetricLimitContent('IMAGE_GENERATION');
  const showQuotaModal = useQuotaModalStore(s => s.show);

  const stop = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  const fetchLatest = useCallback(async () => {
    if (!enabled) return;
    try {
      const a = await api.get<VisualAsset>(`${base}?platform=${platform}`);
      setAsset(a);
      if (!ACTIVE.includes(a.status)) stop();
    } catch (e) {
      stop();
      if (e instanceof ApiError && e.status !== 404) setError(e.message);
    }
  }, [base, platform, enabled, stop]);

  const startPoll = useCallback(() => { stop(); pollRef.current = setInterval(fetchLatest, 2500); }, [fetchLatest, stop]);

  // Load existing asset on mount/output change; resume polling if mid-flight.
  useEffect(() => {
    if (!enabled) { setAsset({ status: 'idle', platform: platform ?? '' }); return; }
    let cancelled = false;
    setAsset({ status: 'idle', platform });
    void (async () => {
      try {
        const a = await api.get<VisualAsset>(`${base}?platform=${platform}`);
        if (cancelled) return;
        setAsset(a);
        if (ACTIVE.includes(a.status)) startPoll();
      } catch { /* 404/idle */ }
    })();
    return () => { cancelled = true; stop(); };
  }, [base, platform, enabled, startPoll, stop]);

  const trigger = useCallback(async (path: string) => {
    if (busy || !enabled) return;
    // Proactive: known-fresh usage says the limit is reached — open the modal
    // instead of sending a request we already know will be rejected.
    if (imageGenLimitContent) { showQuotaModal(imageGenLimitContent); return; }
    setBusy(true); setError(null);
    try {
      const a = await api.post<VisualAsset>(path, { platform });
      setAsset(a);
      startPoll();
      void useUsageStore.getState().fetch();
    } catch (e) {
      // Reactive: usage was stale and the backend rejected anyway — the global
      // 'quota:exceeded' bridge already opened the same modal; skip the banner.
      if (isQuotaApiError(e)) return;
      setError(e instanceof Error ? e.message : 'Could not start visual generation.');
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, platform, startPoll, imageGenLimitContent, showQuotaModal]);

  const generate = useCallback(() => trigger(base), [trigger, base]);
  const regenerate = useCallback(() => trigger(`${base}/regenerate`), [trigger, base]);

  return {
    enabled,
    asset,
    busy,
    error,
    isActive: ACTIVE.includes(asset.status),
    isReady: asset.status === 'ready' && !!asset.finalUrl,
    isFailed: asset.status === 'failed',
    generate,
    regenerate,
  };
}

export type UseVisual = ReturnType<typeof useVisual>;
