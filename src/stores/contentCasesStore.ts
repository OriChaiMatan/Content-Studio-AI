import { create } from 'zustand';
import type {
  ContentCase, ContentOutput, ContentSource, OutputStatus, SourceType, WizardFormData,
} from '../types';
import { mockContentCases } from '../data/mockContentCases';
import { api, ApiError } from '../lib/api';
import { useUsageStore } from './usageStore';

// Roles/Plans/Usage (Phase 3) — best-effort refresh after any action that could
// have consumed a metered quota, so Settings/disabled-state UI stays current.
// Fire-and-forget: a failed refresh just means slightly stale numbers, never a
// blocked action (the backend call itself already succeeded by this point).
function refreshUsage() { void useUsageStore.getState().fetch(); }

type NewSourceInput = { type: SourceType; label: string; content: string; fileData?: string };

interface ContentCasesState {
  cases: ContentCase[];
  loading: boolean;
  error: string | null;
  wizardOpen: boolean;

  // ── Data loading (API → store cache) ──────────────────────────────────────
  fetchCases: () => Promise<void>;
  fetchCaseById: (id: string) => Promise<void>;

  // ── Case CRUD ─────────────────────────────────────────────────────────────
  createCase: (data: WizardFormData) => Promise<ContentCase>;
  updateCase: (id: string, partial: Partial<ContentCase>) => void;
  deleteCase: (id: string) => Promise<void>;  // calls DELETE /api/cases/:id
  // Explicit, user-initiated lifecycle transition — calls POST /api/cases/:id/archive.
  // Frees the case's active-case quota slot; never deletes anything.
  archiveCase: (id: string) => Promise<ContentCase>;
  // Reverses archiveCase — calls POST /api/cases/:id/reactivate. `archiveCaseId`
  // (Free-plan conflict flow) archives that other active case and reactivates
  // this one in one atomic backend transaction. Throws ApiError (e.g. 403
  // case_limit_reached) on failure — the caller decides how to handle it.
  reactivateCase: (id: string, archiveCaseId?: string) => Promise<ContentCase>;
  getCaseById: (id: string) => ContentCase | undefined;
  // Replace (or add) a case in the store from an already-fetched object — used by
  // useLiveCase to keep the global store fresh alongside its local copy.
  upsertCase: (updatedCase: ContentCase) => void;

  // ── Source management — API-first, network-error fallback ───────────────────
  addSource: (caseId: string, source: NewSourceInput) => Promise<ContentSource>;
  // Phase 11B — add several sources in ONE request; analysis runs concurrently
  // server-side. Returns added sources + per-source failures (HTTP 207 partial).
  addSources: (caseId: string, sources: NewSourceInput[]) => Promise<{ added: ContentSource[]; failed: { index: number; error: string }[] }>;
  updateSource: (caseId: string, sourceId: string, updates: { label?: string; content?: string; manualText?: string }) => Promise<void>;
  deleteSource: (caseId: string, sourceId: string) => Promise<void>;

  // ── Output actions — API-backed ────────────────────────────────────────────
  // Local-only optimistic status set (no API) — used by the review page so Approve/
  // Reject feel instant; the API call + rollback-on-failure are driven by the caller.
  setOutputStatusLocal: (caseId: string, outputId: string, status: OutputStatus) => void;
  updateOutputStatus: (caseId: string, outputId: string, status: OutputStatus) => Promise<ContentOutput>;
  updateOutputBody: (caseId: string, outputId: string, body: string) => Promise<ContentOutput>;
  regenerateOutput: (caseId: string, outputId: string) => Promise<ContentOutput>;

  // ── Case refresh — force re-fetch from DB (e.g. after approval changes sources) ──
  refreshCase: (id: string) => Promise<void>;

  // ── Pipeline — API-backed (replaced advancePipeline) ──────────────────────
  // startPipeline: creates PipelineRun with source selection, starts research step.
  //   Re-throws ApiError (e.g. 'no_new_sources') so the UI can surface the message.
  //   Falls back to offline simulation only on network errors.
  startPipeline: (caseId: string, outputLanguage?: 'en' | 'he') => Promise<void>;
  // advancePipelineStep: advances the active run one step (called by the 3s timer).
  advancePipelineStep: (caseId: string) => Promise<void>;
  // runPipeline (Phase 14B): start the SERVER-SIDE runner — POST /pipeline/run returns
  // 202 and the backend drives the run to completion. The UI then polls via refreshCase;
  // it never calls advancePipelineStep for this path. Re-throws ApiError (409/400/404).
  runPipeline: (caseId: string, outputLanguage?: 'en' | 'he') => Promise<void>;

  // ── Wizard ─────────────────────────────────────────────────────────────────
  openWizard: () => void;
  closeWizard: () => void;
}

let idCounter = 100;
function genId(prefix: string) { return `${prefix}-${++idCounter}`; }

export const useContentCasesStore = create<ContentCasesState>()((set, get) => ({
  cases: [],
  loading: true,
  error: null,
  wizardOpen: false,

  // ── Data loading ────────────────────────────────────────────────────────────

  fetchCases: async () => {
    set({ loading: true, error: null });
    try {
      const { cases } = await api.get<{ cases: ContentCase[] }>('/cases');
      set({ cases, loading: false });
    } catch (err) {
      // Fall back to mock data only on network errors (backend unreachable).
      // On ApiError the backend is running — still fall back so the UI works,
      // but log the error for debugging.
      if (err instanceof ApiError) {
        console.warn('[fetchCases] API error', err.status, err.message);
      }
      set({ cases: mockContentCases, loading: false });
    }
  },

  fetchCaseById: async (id: string) => {
    // Skip if case is already loaded — avoids redundant requests on remount.
    // Use refreshCase() when a forced re-fetch is needed (e.g. after approval).
    if (get().cases.find(c => c.id === id)) return;
    try {
      const c = await api.get<ContentCase>(`/cases/${id}`);
      set(state => ({
        cases: state.cases.some(existing => existing.id === id)
          ? state.cases.map(existing => existing.id === id ? c : existing)
          : [...state.cases, c],
      }));
    } catch {
      // Silently fail — the page will show "Case not found"
    }
  },

  // ── Case CRUD ────────────────────────────────────────────────────────────────

  getCaseById: (id) => get().cases.find(c => c.id === id),

  upsertCase: (updatedCase) =>
    set(state => ({
      cases: state.cases.some(c => c.id === updatedCase.id)
        ? state.cases.map(c => c.id === updatedCase.id ? updatedCase : c)
        : [...state.cases, updatedCase],
    })),

  createCase: async (data: WizardFormData) => {
    try {
      const newCase = await api.post<ContentCase>('/cases', {
        title:          data.title,
        language:       data.language,
        contentGoal:    data.contentGoal,
        goalCustom:     data.goalCustom,
        contentStyle:   data.contentStyle,
        styleCustom:    data.styleCustom,
        contentTargets: data.contentTargets,
        // Schedule (Phase 8.6) — only send the fields relevant to the frequency.
        scheduleFrequency:  data.scheduleFrequency,
        scheduleTime:       data.scheduleFrequency === 'manual' ? null : data.scheduleTime,
        scheduleDayOfWeek:  data.scheduleFrequency === 'weekly'  ? data.scheduleDayOfWeek  : null,
        scheduleDayOfMonth: data.scheduleFrequency === 'monthly' ? data.scheduleDayOfMonth : null,
      });
      set(state => ({ cases: [newCase, ...state.cases] }));
      refreshUsage();
      return newCase;
    } catch (err) {
      // Only fall back to a local mock case when the backend is genuinely
      // unreachable (TypeError = network failure, e.g. server not running).
      // For ApiError (4xx / 5xx) the server IS running — re-throw so the
      // wizard can surface the real error message to the user.
      if (err instanceof ApiError) throw err;

      // Network error fallback — lets the wizard still complete offline.
      const now = new Date().toISOString();
      const caseId = genId('case');
      const mockCase: ContentCase = {
        id: caseId,
        title:          data.title,
        status:         'draft',
        lifecycleStatus: 'ACTIVE',
        archivedAt:     null,
        pipelineRunCount: 0,
        language:       data.language,
        contentGoal:    data.contentGoal,
        goalCustom:     data.goalCustom || null,
        contentStyle:   data.contentStyle,
        styleCustom:    data.styleCustom || null,
        contentTargets: data.contentTargets,
        // Legacy fields default to empty for new wizard cases
        targetAudience: '', industry: '', experienceLevel: 'intermediate',
        writingStyle: '', goals: '', aiInstructions: '',
        schedule: {
          frequency:  data.scheduleFrequency,
          time:       data.scheduleFrequency === 'manual' ? null : data.scheduleTime,
          dayOfWeek:  data.scheduleFrequency === 'weekly'  ? data.scheduleDayOfWeek  : null,
          dayOfMonth: data.scheduleFrequency === 'monthly' ? data.scheduleDayOfMonth : null,
        },
        sources: [],
        outputs: [],
        pipeline: [
          { id: genId('step'), name: 'research',         status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
          { id: genId('step'), name: 'fact_check',       status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
          { id: genId('step'), name: 'content_creation', status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
        ],
        currentRun: null,
        createdAt: now,
        updatedAt: now,
      };
      set(state => ({ cases: [mockCase, ...state.cases] }));
      return mockCase;
    }
  },

  updateCase: (id, partial) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c,
      ),
    })),

  deleteCase: async (id) => {
    // Calls the API first; cascade deletes all related records server-side.
    // Only removes from local store on success.
    await api.delete(`/cases/${id}`);
    set(state => ({ cases: state.cases.filter(c => c.id !== id) }));
  },

  archiveCase: async (id) => {
    const updated = await api.post<ContentCase>(`/cases/${id}/archive`, {});
    set(state => ({ cases: state.cases.map(c => c.id === id ? updated : c) }));
    // Archiving frees an active-case quota slot — refresh so Settings/the
    // Sidebar's cached usage numbers don't stay stale.
    refreshUsage();
    return updated;
  },

  reactivateCase: async (id, archiveCaseId) => {
    // Re-throws ApiError on failure (e.g. 403 case_limit_reached) — no catch
    // here, since the caller (Case Detail's Reactivate button) needs to branch
    // on that to open the Free-plan conflict modal instead of a generic error.
    const updated = await api.post<ContentCase>(`/cases/${id}/reactivate`, archiveCaseId ? { archiveCaseId } : {});
    set(state => ({
      cases: state.cases.map(c => {
        if (c.id === id) return updated;
        // The atomic swap archives the other case server-side too — reflect
        // that locally without waiting for a separate re-fetch.
        if (archiveCaseId && c.id === archiveCaseId) return { ...c, lifecycleStatus: 'ARCHIVED', archivedAt: new Date().toISOString() };
        return c;
      }),
    }));
    refreshUsage();
    return updated;
  },

  // ── Source management ────────────────────────────────────────────────────────

  addSource: async (caseId, sourceInput) => {
    try {
      const newSource = await api.post<ContentSource>(
        `/cases/${caseId}/sources`,
        {
          type: sourceInput.type,
          label: sourceInput.label,
          content: sourceInput.content,
          ...(sourceInput.fileData ? { fileData: sourceInput.fileData } : {}),
        },
      );
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: [...c.sources, newSource],
            // Optimistic bump so the Sources panel's per-case disabled-state
            // check reflects the new count immediately (the field only comes
            // from a full case re-fetch otherwise).
            sourceUsage: c.sourceUsage ? { ...c.sourceUsage, used: c.sourceUsage.used + 1 } : c.sourceUsage,
            updatedAt: new Date().toISOString(),
          },
        ),
      }));
      refreshUsage();
      return newSource;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network fallback — keep working offline
      const now = new Date().toISOString();
      const local: ContentSource = {
        id: genId('src'),
        contentCaseId: caseId,
        type: sourceInput.type,
        label: sourceInput.label || sourceInput.type,
        content: sourceInput.content,
        status: 'new',
        usedInRunId: null,
        lastUsedAt: null,
        sourceIntelligence: null,  // will be generated when API is available
        createdAt: now,
        updatedAt: null,
      };
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : { ...c, sources: [...c.sources, local], updatedAt: now },
        ),
      }));
      return local;
    }
  },

  addSources: async (caseId, inputs) => {
    // Phase 11B — single round-trip to the concurrent batch endpoint. 207 = partial
    // success; successful sources are merged into the store, failures are returned
    // so the UI can show them without blocking the ones that succeeded.
    type BatchResult =
      | { index: number; ok: true; source: ContentSource }
      | { index: number; ok: false; error: string };
    const { results } = await api.post<{ results: BatchResult[] }>(
      `/cases/${caseId}/sources/batch`,
      { sources: inputs.map(s => ({ type: s.type, label: s.label, content: s.content, ...(s.fileData ? { fileData: s.fileData } : {}) })) },
    );
    const added = results.filter((r): r is Extract<BatchResult, { ok: true }> => r.ok).map(r => r.source);
    const failed = results.filter((r): r is Extract<BatchResult, { ok: false }> => !r.ok).map(r => ({ index: r.index, error: r.error }));
    if (added.length) {
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: [...c.sources, ...added],
            sourceUsage: c.sourceUsage ? { ...c.sourceUsage, used: c.sourceUsage.used + added.length } : c.sourceUsage,
            updatedAt: new Date().toISOString(),
          },
        ),
      }));
      refreshUsage();
    }
    return { added, failed };
  },

  updateSource: async (caseId, sourceId, updates) => {
    try {
      const updated = await api.patch<ContentSource>(
        `/cases/${caseId}/sources/${sourceId}`,
        updates,
      );
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: c.sources.map(s => s.id !== sourceId ? s : updated),
            updatedAt: new Date().toISOString(),
          },
        ),
      }));
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network fallback
      const now = new Date().toISOString();
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: c.sources.map(s =>
              s.id !== sourceId ? s : { ...s, ...updates, updatedAt: now },
            ),
            updatedAt: now,
          },
        ),
      }));
    }
  },

  deleteSource: async (caseId, sourceId) => {
    try {
      await api.delete(`/cases/${caseId}/sources/${sourceId}`);
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: c.sources.filter(s => s.id !== sourceId),
            updatedAt: new Date().toISOString(),
          },
        ),
      }));
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network fallback
      const now = new Date().toISOString();
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: c.sources.filter(s => s.id !== sourceId),
            updatedAt: now,
          },
        ),
      }));
    }
  },

  // ── Output actions — API-backed ──────────────────────────────────────────────

  setOutputStatusLocal: (caseId, outputId, status) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o => o.id !== outputId ? o : { ...o, status }),
        },
      ),
    })),

  updateOutputStatus: async (caseId, outputId, status) => {
    const updated = await api.patch<ContentOutput>(
      `/cases/${caseId}/outputs/${outputId}/status`,
      { status },
    );
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o => o.id !== outputId ? o : updated),
        },
      ),
    }));
    return updated;
  },

  updateOutputBody: async (caseId, outputId, body) => {
    const updated = await api.patch<ContentOutput>(
      `/cases/${caseId}/outputs/${outputId}`,
      { body },
    );
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o => o.id !== outputId ? o : updated),
        },
      ),
    }));
    return updated;
  },

  regenerateOutput: async (caseId, outputId) => {
    const updated = await api.post<ContentOutput>(
      `/cases/${caseId}/outputs/${outputId}/regenerate`,
      {},
    );
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o => o.id !== outputId ? o : updated),
        },
      ),
    }));
    refreshUsage();
    return updated;
  },

  // Force re-fetch a case from the API — used after approval changes source statuses
  refreshCase: async (id) => {
    try {
      const c = await api.get<ContentCase>(`/cases/${id}`);
      set(state => ({
        cases: state.cases.map(existing => existing.id === id ? c : existing),
      }));
    } catch {
      // Silently fail — stale data is acceptable here
    }
  },

  // ── Pipeline ─────────────────────────────────────────────────────────────────

  startPipeline: async (caseId, outputLanguage) => {
    try {
      const updatedCase = await api.post<ContentCase>(`/cases/${caseId}/pipeline/start`,
        outputLanguage ? { outputLanguage } : {});
      set(state => ({
        cases: state.cases.map(c => c.id !== caseId ? c : updatedCase),
      }));
      refreshUsage();
    } catch (err) {
      // Re-throw ApiError so the Pipeline page can surface the message (e.g. no_new_sources).
      if (err instanceof ApiError) throw err;

      // Network fallback — run simulation locally so the UI still works offline.
      _offlineAdvance(caseId, set, get);
    }
  },

  advancePipelineStep: async (caseId) => {
    try {
      const updatedCase = await api.post<ContentCase>(`/cases/${caseId}/pipeline/advance`, {});
      set(state => ({
        cases: state.cases.map(c => c.id !== caseId ? c : updatedCase),
      }));
    } catch {
      // Network error during advance — the timer will retry naturally on next fire.
      // ApiError is unlikely here (no user input involved), so no need to re-throw.
    }
  },

  runPipeline: async (caseId, outputLanguage) => {
    // 202 Accepted — the server-side runner is now driving the run. Re-throw ApiError
    // (already_running 409 / no_new_sources 400 / 404) so the page can surface it.
    await api.post<{ accepted: boolean; caseId: string }>(
      `/cases/${caseId}/pipeline/run`,
      outputLanguage ? { outputLanguage } : {},
    );
    // Reflect "research running" immediately; polling (refreshCase) takes over from here.
    await get().refreshCase(caseId);
    refreshUsage();
  },

  openWizard:  () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
}));

// ── Offline pipeline fallback ─────────────────────────────────────────────────
// Used only by startPipeline when the backend is genuinely unreachable (network error).
// Advances one step at a time in Zustand memory, creating mock outputs in the final step.
function _offlineAdvance(
  caseId: string,
  set: (fn: (s: { cases: ContentCase[] }) => Partial<{ cases: ContentCase[] }>) => void,
  get: () => { cases: ContentCase[] },
) {
  const c = get().cases.find(c => c.id === caseId);
  if (!c) return;
  const now = new Date().toISOString();
  const nextIdle = c.pipeline.find(s => s.status === 'idle');
  if (nextIdle) {
    set(state => ({
      cases: state.cases.map(existing =>
        existing.id !== caseId ? existing : {
          ...existing,
          status: 'research',
          pipeline: existing.pipeline.map(s =>
            s.id !== nextIdle.id ? s : { ...s, status: 'running' as const, startedAt: now },
          ),
          updatedAt: now,
        },
      ),
    }));
  }
}

// Phase 12 fix — NO auto-fetch on module import. /api/cases is a PROTECTED endpoint and
// must not be called before authentication is resolved (it would 401 on boot for a
// logged-out user). The fetch is now triggered from AuthedApp, which only mounts when
// authStore.status === 'authenticated'.
