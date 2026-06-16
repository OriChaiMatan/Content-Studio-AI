import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { ContentCase } from '../../types';

// Live case data for a mounted case page.
//
// Returns the case, kept fresh while the page is open by polling GET /cases/:id
// every 5s DIRECTLY into local React state. Going through local state (rather than
// the Zustand store selector) guarantees a re-render on every successful fetch — this
// is the pattern proven to update the pipeline page live (scheduled run start, step
// progress, completion, new WhatsApp sources) without a manual refresh.
//
// The store is still seeded (fetchCaseById) so navigation/lists stay consistent; the
// returned value prefers the live copy and falls back to the store copy until the
// first live fetch lands.
export function useLiveCase(id: string | undefined): ContentCase | undefined {
  const caseItem      = useContentCasesStore(s => s.getCaseById(id ?? ''));
  const fetchCaseById = useContentCasesStore(s => s.fetchCaseById);
  const [liveCase, setLiveCase] = useState<ContentCase | null>(null);

  // Seed the store if this case isn't loaded yet (direct URL / refresh / navigation).
  useEffect(() => {
    if (!id) return;
    void fetchCaseById(id);
  }, [id, fetchCaseById]);

  // Always-on direct poll into local state: immediate, then every 5s. Cleared on
  // unmount / id change.
  useEffect(() => {
    if (!id) return;
    let active = true;
    const fetchLive = async () => {
      try {
        const c = await api.get<ContentCase>(`/cases/${id}`);
        if (active) setLiveCase(c);
      } catch {
        // Keep the last good copy; the next tick retries.
      }
    };
    void fetchLive();
    const t = setInterval(fetchLive, 5000);
    return () => { active = false; clearInterval(t); };
  }, [id]);

  return liveCase ?? caseItem;
}
