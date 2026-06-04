import { create } from 'zustand';
import type {
  ContentCase, ContentOutput, ContentSource, OutputStatus, SourceType, WizardFormData,
} from '../types';
import { mockContentCases } from '../data/mockContentCases';
import { api, ApiError } from '../lib/api';

type NewSourceInput = { type: SourceType; label: string; content: string };

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
  deleteCase: (id: string) => void;
  getCaseById: (id: string) => ContentCase | undefined;

  // ── Source management — API-first, network-error fallback ───────────────────
  addSource: (caseId: string, source: NewSourceInput) => Promise<ContentSource>;
  updateSource: (caseId: string, sourceId: string, updates: { label?: string; content?: string }) => Promise<void>;
  deleteSource: (caseId: string, sourceId: string) => Promise<void>;

  // ── Output actions — API-backed ────────────────────────────────────────────
  updateOutputStatus: (caseId: string, outputId: string, status: OutputStatus) => Promise<ContentOutput>;
  updateOutputBody: (caseId: string, outputId: string, body: string) => Promise<ContentOutput>;
  regenerateOutput: (caseId: string, outputId: string) => Promise<ContentOutput>;

  // ── Case refresh — force re-fetch from DB (e.g. after approval changes sources) ──
  refreshCase: (id: string) => Promise<void>;

  // ── Pipeline — API-backed (replaced advancePipeline) ──────────────────────
  // startPipeline: creates PipelineRun with source selection, starts research step.
  //   Re-throws ApiError (e.g. 'no_new_sources') so the UI can surface the message.
  //   Falls back to offline simulation only on network errors.
  startPipeline: (caseId: string) => Promise<void>;
  // advancePipelineStep: advances the active run one step (called by the 3s timer).
  advancePipelineStep: (caseId: string) => Promise<void>;

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

  createCase: async (data: WizardFormData) => {
    try {
      const newCase = await api.post<ContentCase>('/cases', {
        title:          data.title,
        contentGoal:    data.contentGoal,
        goalCustom:     data.goalCustom,
        contentStyle:   data.contentStyle,
        styleCustom:    data.styleCustom,
        language:       data.language,
        contentTargets: data.contentTargets,
      });
      set(state => ({ cases: [newCase, ...state.cases] }));
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
        language:       data.language,
        contentGoal:    data.contentGoal,
        goalCustom:     data.goalCustom || null,
        contentStyle:   data.contentStyle,
        styleCustom:    data.styleCustom || null,
        contentTargets: data.contentTargets,
        // Legacy fields default to empty for new wizard cases
        targetAudience: '', industry: '', experienceLevel: 'intermediate',
        writingStyle: '', goals: '', aiInstructions: '',
        schedule: { frequency: 'manual', time: null, dayOfWeek: null, dayOfMonth: null },
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

  deleteCase: (id) =>
    set(state => ({ cases: state.cases.filter(c => c.id !== id) })),

  // ── Source management ────────────────────────────────────────────────────────

  addSource: async (caseId, sourceInput) => {
    try {
      const newSource = await api.post<ContentSource>(
        `/cases/${caseId}/sources`,
        { type: sourceInput.type, label: sourceInput.label, content: sourceInput.content },
      );
      set(state => ({
        cases: state.cases.map(c =>
          c.id !== caseId ? c : {
            ...c,
            sources: [...c.sources, newSource],
            updatedAt: new Date().toISOString(),
          },
        ),
      }));
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

  startPipeline: async (caseId) => {
    try {
      const updatedCase = await api.post<ContentCase>(`/cases/${caseId}/pipeline/start`, {});
      set(state => ({
        cases: state.cases.map(c => c.id !== caseId ? c : updatedCase),
      }));
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

// Trigger initial data load as soon as the store module is imported.
// Uses a microtask so the store is fully initialized before the fetch starts.
queueMicrotask(() => {
  useContentCasesStore.getState().fetchCases();
});
