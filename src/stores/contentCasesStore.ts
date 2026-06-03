import { create } from 'zustand';
import type {
  ContentCase, ContentSource, OutputStatus, SourceType, WizardFormData, PipelineStep,
} from '../types';
import { mockContentCases } from '../data/mockContentCases';
import { api } from '../lib/api';

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
  // createCase is async: calls the API, falls back to mock on failure.
  createCase: (data: WizardFormData) => Promise<ContentCase>;
  updateCase: (id: string, partial: Partial<ContentCase>) => void;
  deleteCase: (id: string) => void;
  getCaseById: (id: string) => ContentCase | undefined;

  // ── Source management (Phase 3 will move these to the API) ────────────────
  addSource: (caseId: string, source: NewSourceInput) => ContentSource;
  updateSource: (caseId: string, sourceId: string, updates: { label?: string; content?: string }) => void;
  deleteSource: (caseId: string, sourceId: string) => void;

  // ── Output actions (Phase 5 will move these to the API) ───────────────────
  updateOutputStatus: (caseId: string, outputId: string, status: OutputStatus) => void;
  updateOutputBody: (caseId: string, outputId: string, body: string) => void;
  regenerateOutput: (caseId: string, outputId: string) => void;

  // ── Pipeline simulation (Phase 4 will move this to real workers) ──────────
  advancePipeline: (caseId: string) => void;

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
    } catch {
      // API unavailable — fall back to mock data so the UI stays usable.
      set({ cases: mockContentCases, loading: false });
    }
  },

  fetchCaseById: async (id: string) => {
    // If the case is already in the store, don't re-fetch.
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
        title:           data.title,
        language:        data.language,
        targetAudience:  data.targetAudience,
        industry:        data.industry,
        experienceLevel: data.experienceLevel,
        writingStyle:    data.writingStyle,
        goals:           data.goals,
        aiInstructions:  data.aiInstructions,
        sources:         data.sources,
        schedule:        data.schedule,
      });
      set(state => ({ cases: [newCase, ...state.cases] }));
      return newCase;
    } catch {
      // API unavailable — create locally so the user's work is not lost.
      const now = new Date().toISOString();
      const caseId = genId('case');
      const mockCase: ContentCase = {
        id: caseId,
        title: data.title,
        status: 'draft',
        language: data.language,
        targetAudience: data.targetAudience,
        industry: data.industry,
        experienceLevel: data.experienceLevel,
        writingStyle: data.writingStyle,
        goals: data.goals,
        aiInstructions: data.aiInstructions,
        schedule: data.schedule,
        sources: data.sources.map(s => ({
          ...s, id: genId('src'), contentCaseId: caseId, createdAt: now, updatedAt: null,
        })),
        outputs: [],
        pipeline: [
          { id: genId('step'), name: 'research',         status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
          { id: genId('step'), name: 'fact_check',       status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
          { id: genId('step'), name: 'content_creation', status: 'idle', startedAt: null, completedAt: null, summary: null, confidence: null },
        ],
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

  addSource: (caseId, sourceInput) => {
    const now = new Date().toISOString();
    const newSource: ContentSource = {
      id: genId('src'),
      contentCaseId: caseId,
      type: sourceInput.type,
      label: sourceInput.label || sourceInput.type,
      content: sourceInput.content,
      createdAt: now,
      updatedAt: null,
    };
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : { ...c, sources: [...c.sources, newSource], updatedAt: now },
      ),
    }));
    return newSource;
  },

  updateSource: (caseId, sourceId, updates) => {
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
  },

  deleteSource: (caseId, sourceId) => {
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
  },

  // ── Output actions ───────────────────────────────────────────────────────────

  updateOutputStatus: (caseId, outputId, status) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o =>
            o.id !== outputId ? o : { ...o, status, reviewedAt: new Date().toISOString() },
          ),
        },
      ),
    })),

  updateOutputBody: (caseId, outputId, body) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o => o.id !== outputId ? o : { ...o, body }),
        },
      ),
    })),

  regenerateOutput: (caseId, outputId) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id !== caseId ? c : {
          ...c,
          outputs: c.outputs.map(o =>
            o.id !== outputId ? o : {
              ...o,
              status: 'draft',
              body: o.body + '\n\n[Regenerated version — AI would replace this content]',
              version: bumpVersion(o.version),
              generatedAt: new Date().toISOString(),
              reviewedAt: null,
            },
          ),
        },
      ),
    })),

  // ── Pipeline simulation ──────────────────────────────────────────────────────

  advancePipeline: (caseId) => {
    const c = get().cases.find(c => c.id === caseId);
    if (!c) return;

    const now = new Date().toISOString();
    const nextIdle = c.pipeline.find(s => s.status === 'idle');
    const running  = c.pipeline.find(s => s.status === 'running');

    const summaries: Record<PipelineStep['name'], { summary: string; confidence: number }> = {
      research:         { summary: 'Identified 14 primary sources. Key themes extracted and cross-referenced.', confidence: 91 },
      fact_check:       { summary: 'Cross-referenced 47 claims. All key statistics verified. 2 minor discrepancies resolved.', confidence: 96 },
      content_creation: { summary: 'Generated 6 platform-specific drafts ready for review.', confidence: 88 },
    };

    let newPipeline = c.pipeline;
    let newStatus   = c.status;
    let newOutputs  = c.outputs;

    if (running) {
      const completedPipeline = c.pipeline.map(s =>
        s.id !== running.id ? s : {
          ...s, status: 'completed' as const, completedAt: now,
          summary: summaries[s.name].summary, confidence: summaries[s.name].confidence,
        },
      );

      if (running.name === 'content_creation') {
        newStatus = 'in_review';
        newPipeline = completedPipeline;
        const platforms = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt'] as const;
        newOutputs = platforms.map((platform, i) => ({
          id: genId('output'),
          contentCaseId: caseId,
          platform,
          title: `${c.title} — ${platform.replace('_', ' ')}`,
          body: `This is the AI-generated draft for ${platform} based on your research and instructions.\n\nEdit, regenerate, or approve it below.`,
          status: 'draft' as const,
          version: 'v1.0.0',
          contentScore: 70 + i * 3,
          researchConfidence: 91,
          factCheckAccuracy: 96,
          generatedAt: now,
          reviewedAt: null,
        }));
      } else {
        const afterComplete = completedPipeline.findIndex(s => s.status === 'idle');
        newPipeline = completedPipeline.map((s, idx) =>
          idx !== afterComplete ? s : { ...s, status: 'running' as const, startedAt: now },
        );
        newStatus = running.name === 'research' ? 'fact_check' : 'generating';
      }
    } else if (nextIdle) {
      newPipeline = c.pipeline.map(s =>
        s.id !== nextIdle.id ? s : { ...s, status: 'running' as const, startedAt: now },
      );
      newStatus = nextIdle.name === 'research' ? 'research' : nextIdle.name === 'fact_check' ? 'fact_check' : 'generating';
    }

    set(state => ({
      cases: state.cases.map(existing =>
        existing.id !== caseId ? existing : {
          ...existing, status: newStatus, pipeline: newPipeline, outputs: newOutputs, updatedAt: now,
        },
      ),
    }));
  },

  openWizard:  () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
}));

function bumpVersion(version: string): string {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return version;
  return `v${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
}

// Trigger initial data load as soon as the store module is imported.
// Uses a microtask so the store is fully initialized before the fetch starts.
queueMicrotask(() => {
  useContentCasesStore.getState().fetchCases();
});
