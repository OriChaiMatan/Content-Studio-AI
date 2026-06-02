import { create } from 'zustand';
import type { ContentCase, OutputStatus, WizardFormData, PipelineStep } from '../types';
import { mockContentCases } from '../data/mockContentCases';

interface ContentCasesState {
  cases: ContentCase[];
  wizardOpen: boolean;

  // Case CRUD
  createCase: (data: WizardFormData) => ContentCase;
  updateCase: (id: string, partial: Partial<ContentCase>) => void;
  deleteCase: (id: string) => void;
  getCaseById: (id: string) => ContentCase | undefined;

  // Output actions
  updateOutputStatus: (caseId: string, outputId: string, status: OutputStatus) => void;
  updateOutputBody: (caseId: string, outputId: string, body: string) => void;
  regenerateOutput: (caseId: string, outputId: string) => void;

  // Pipeline simulation
  advancePipeline: (caseId: string) => void;

  // Wizard
  openWizard: () => void;
  closeWizard: () => void;
}

let idCounter = 100;
function genId(prefix: string) { return `${prefix}-${++idCounter}`; }

export const useContentCasesStore = create<ContentCasesState>()((set, get) => ({
  cases: mockContentCases,
  wizardOpen: false,

  getCaseById: (id) => get().cases.find(c => c.id === id),

  createCase: (data) => {
    const now = new Date().toISOString();
    const caseId = genId('case');
    const newCase: ContentCase = {
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
      sources: data.sources.map((s) => ({
        ...s,
        id: genId('src'),
        contentCaseId: caseId,
        createdAt: now,
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
    set(state => ({ cases: [newCase, ...state.cases] }));
    return newCase;
  },

  updateCase: (id, partial) =>
    set(state => ({
      cases: state.cases.map(c =>
        c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c,
      ),
    })),

  deleteCase: (id) =>
    set(state => ({ cases: state.cases.filter(c => c.id !== id) })),

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
          outputs: c.outputs.map(o =>
            o.id !== outputId ? o : { ...o, body },
          ),
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

  // Simulates advancing the pipeline one step at a time
  advancePipeline: (caseId) => {
    const c = get().cases.find(c => c.id === caseId);
    if (!c) return;

    const now = new Date().toISOString();
    const nextIdle = c.pipeline.find(s => s.status === 'idle');
    const running = c.pipeline.find(s => s.status === 'running');

    const summaries: Record<PipelineStep['name'], { summary: string; confidence: number }> = {
      research:         { summary: 'Identified 14 primary sources. Key themes extracted and cross-referenced.', confidence: 91 },
      fact_check:       { summary: 'Cross-referenced 47 claims. All key statistics verified. 2 minor discrepancies resolved.', confidence: 96 },
      content_creation: { summary: 'Generated 6 platform-specific drafts ready for review.', confidence: 88 },
    };

    let newPipeline = c.pipeline;
    let newStatus = c.status;
    let newOutputs = c.outputs;

    if (running) {
      // Complete the running step
      const completedPipeline = c.pipeline.map(s =>
        s.id !== running.id ? s : {
          ...s,
          status: 'completed' as const,
          completedAt: now,
          summary: summaries[s.name].summary,
          confidence: summaries[s.name].confidence,
        },
      );

      if (running.name === 'content_creation') {
        // Final step: generate outputs and move to review
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
        // Intermediate step: also start the next idle step atomically
        const afterComplete = completedPipeline.findIndex(s => s.status === 'idle');
        newPipeline = completedPipeline.map((s, idx) =>
          idx !== afterComplete ? s : { ...s, status: 'running' as const, startedAt: now },
        );
        newStatus = running.name === 'research' ? 'fact_check' : 'generating';
      }
    } else if (nextIdle) {
      // No running step — start the first idle step
      newPipeline = c.pipeline.map(s =>
        s.id !== nextIdle.id ? s : { ...s, status: 'running' as const, startedAt: now },
      );
      newStatus = nextIdle.name === 'research' ? 'research' : nextIdle.name === 'fact_check' ? 'fact_check' : 'generating';
    }

    set(state => ({
      cases: state.cases.map(existing =>
        existing.id !== caseId ? existing : {
          ...existing,
          status: newStatus,
          pipeline: newPipeline,
          outputs: newOutputs,
          updatedAt: now,
        },
      ),
    }));
  },

  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
}));

function bumpVersion(version: string): string {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return version;
  return `v${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
}
