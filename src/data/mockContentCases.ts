import type { ContentCase, ContentOutput, ContentSource, PipelineStep } from '../types';

// Adds required lifecycle fields to mock source objects (all start as 'new').
function src(s: Omit<ContentSource, 'status' | 'usedInRunId' | 'lastUsedAt'>): ContentSource {
  return { ...s, status: 'new', usedInRunId: null, lastUsedAt: null };
}

// ── Pipeline helpers ──────────────────────────────────────

function makePipeline(stage: 'idle' | 'research' | 'fact_check' | 'completed'): PipelineStep[] {
  const done = (name: PipelineStep['name'], summary: string, confidence: number): PipelineStep => ({
    id: `${name}-done`,
    name,
    status: 'completed',
    startedAt: '2024-03-10T08:00:00.000Z',
    completedAt: '2024-03-10T08:12:00.000Z',
    summary,
    confidence,
  });
  const idle = (name: PipelineStep['name']): PipelineStep => ({
    id: `${name}-idle`,
    name,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    summary: null,
    confidence: null,
  });

  if (stage === 'idle') return [idle('research'), idle('fact_check'), idle('content_creation')];
  if (stage === 'research') return [
    { ...idle('research'), id: 'research-running', status: 'running', startedAt: new Date().toISOString() },
    idle('fact_check'),
    idle('content_creation'),
  ];
  if (stage === 'fact_check') return [
    done('research', 'Identified 14 primary sources. Key themes: quantum error correction, supply chain algorithms, silicon photonics.', 91),
    { ...idle('fact_check'), id: 'fact-check-running', status: 'running', startedAt: new Date().toISOString() },
    idle('content_creation'),
  ];
  return [
    done('research', 'Identified 14 primary sources. Key themes: quantum error correction, supply chain algorithms, silicon photonics.', 91),
    done('fact_check', 'Cross-referenced 47 claims. 2 minor discrepancies resolved. All key statistics verified.', 96),
    done('content_creation', 'Generated 6 platform-specific drafts ready for review.', 88),
  ];
}

// ── Output helpers ────────────────────────────────────────

function makeOutputs(caseId: string): ContentOutput[] {
  const platforms = ['linkedin', 'facebook', 'newsletter', 'podcast'] as const;
  const data: Record<string, { title: string; body: string }> = {
    linkedin: {
      title: 'Quantum Supremacy & Global Logistics',
      body: `The convergence of quantum computing and supply chain optimization is reshaping global trade.\n\nNew algorithms running on quantum hardware are solving routing problems that classical computers take weeks to process — in under 10 minutes. This isn't a distant future. Early adopters in the shipping industry are already reporting 23% reductions in fuel costs.\n\nKey implications for logistics leaders:\n• Dynamic re-routing based on real-time quantum optimization\n• Predictive demand modeling with 40% higher accuracy\n• Reduced last-mile delivery costs through probabilistic scheduling\n\nThe question isn't whether to adopt this technology — it's how fast you can build the internal capability to leverage it.\n\n#QuantumComputing #SupplyChain #FutureOfLogistics`,
    },
    facebook: {
      title: "How Quantum Computers Are Solving the World's Logistics Problem",
      body: `Did you know that quantum computers can solve shipping route problems that would take a classical computer weeks to crack — all in under 10 minutes?\n\nWe dug deep into the research, and the results are staggering. Early adopters in global shipping are already seeing 23% fuel savings and dramatically more accurate demand forecasts.\n\nHere's what's changing:\n✅ Real-time re-routing during disruptions\n✅ Better demand predictions\n✅ Lower delivery costs\n\nThe quantum revolution is here — and it's starting with your supply chain.`,
    },
    newsletter: {
      title: 'Weekly Digest: Quantum Computing Meets Global Supply Chain',
      body: `This week, we're exploring one of the most consequential technological intersections of our decade: quantum computing and supply chain optimization.\n\n**What we covered:**\n\nQuantum error correction has crossed a critical threshold, enabling stable long-form calculations on real-world logistics datasets. Three major shipping companies have begun pilot programs, with results suggesting a 15–23% reduction in operational fuel costs.\n\nThe Silicon Photonics angle: New chip architectures that leverage light instead of electrons are extending quantum coherence times, making practical quantum logistics systems economically viable for the first time.\n\n**What to watch next week:**\nThe EU's proposed regulatory framework for quantum-assisted trade routing decisions.\n\n*— Alex Rivera, Lead Researcher*`,
    },
    podcast: {
      title: 'Ep. 38 Outline: Quantum Logistics Revolution',
      body: `EPISODE OUTLINE — "Green Horizon" Episode 38\n\nTitle: "The Quantum Logistics Revolution: How Qubits Are Saving the Planet One Shipping Route at a Time"\n\n[COLD OPEN – 0:00-1:30]\nHook: The container ship that chose its route using a quantum algorithm\n\n[SEGMENT 1 – 1:30-12:00]\nWhat quantum computing actually is (no jargon version)\nGuest intro: Dr. Marcus Chen, MIT Quantum Systems Lab\n\n[SEGMENT 2 – 12:00-28:00]\nThe logistics problem that classical computers can't solve\nHow quantum annealing changes the math\nReal-world pilot results from ShipNext and Maersk Digital\n\n[SEGMENT 3 – 28:00-40:00]\nEnvironmental angle: 23% fuel reduction = real emissions impact\nTimeline: when does this become mainstream?\n\n[CLOSE – 40:00-45:00]\nKey takeaways + listener action items`,
    },
  };

  return platforms.map((platform, i) => ({
    id: `output-${caseId}-${platform}`,
    contentCaseId: caseId,
    pipelineRunId: `mock-run-${caseId}`,
    platform,
    title: data[platform].title,
    body: data[platform].body,
    status: i < 2 ? 'approved' : i === 5 ? 'rejected' : 'draft',
    version: `v${i + 1}.0.0`,
    contentScore: 72 + i * 4,
    researchConfidence: 91,
    factCheckAccuracy: 96,
    generatedAt: '2024-03-10T10:00:00.000Z',
    reviewedAt: i < 2 ? '2024-03-12T14:00:00.000Z' : null,
  }));
}

// ── Mock cases ────────────────────────────────────────────
// Sources show different createdAt dates to demonstrate the
// "ongoing workspace" model — sources added over multiple sessions.

export const mockContentCases: ContentCase[] = [
  {
    id: 'case-1',
    title: 'Quantum Computing 2024',
    status: 'in_review',
    language: 'en',
    contentGoal: 'build_authority',
    goalCustom: null,
    contentStyle: 'professional',
    styleCustom: null,
    contentTargets: ['linkedin','facebook','newsletter','podcast','images'],
    targetAudience: 'Logistics executives and supply chain managers at Fortune 500 companies',
    industry: 'Technology & Logistics',
    experienceLevel: 'expert',
    writingStyle: 'Authoritative and data-driven with accessible analogies',
    goals: 'Position our team as thought leaders in quantum applications for enterprise logistics. Drive newsletter signups and LinkedIn engagement.',
    aiInstructions: 'Avoid excessive jargon. Always ground claims in cited research. Maintain a tone that is optimistic but not hyperbolic. Use active voice.',
    schedule: { frequency: 'weekly', time: '09:00', dayOfWeek: 1, dayOfMonth: null },
    sources: [
      src({
        id: 'src-c1-1',
        contentCaseId: 'case-1',
        type: 'text',
        label: 'Initial research notes',
        content: 'Quantum computing breakthroughs in 2024 have focused on error correction (Google Willow chip achieving 105 qubits with sub-threshold error rates) and practical applications in optimization problems including supply chain routing, drug discovery, and financial modeling.',
        createdAt: '2024-03-01T09:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c1-2',
        contentCaseId: 'case-1',
        type: 'url',
        label: 'MIT Technology Review — Quantum Logistics',
        content: 'https://www.technologyreview.com/2024/quantum-logistics',
        createdAt: '2024-03-03T14:22:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c1-3',
        contentCaseId: 'case-1',
        type: 'pdf',
        label: 'Q1 Industry Research Report',
        content: 'Q1_Quantum_Logistics_Report.pdf',
        createdAt: '2024-03-05T10:15:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c1-4',
        contentCaseId: 'case-1',
        type: 'url',
        label: 'Maersk Digital Quantum Pilot Announcement',
        content: 'https://maersk.com/digital/quantum-pilot-2024',
        createdAt: '2024-03-07T16:40:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c1-5',
        contentCaseId: 'case-1',
        type: 'text',
        label: 'Expert interview notes — Dr. Marcus Chen',
        content: 'Key insight from interview: quantum annealing is commercially viable for routing problems with 500+ nodes. Classical simulated annealing tops out around 200 nodes efficiently. Timeline to mainstream adoption: 3-5 years for early adopters, 8-10 years for industry standard.',
        createdAt: '2024-03-09T11:30:00.000Z',
        updatedAt: '2024-03-09T15:00:00.000Z',
        sourceIntelligence: null,
      }),
    ],
    outputs: makeOutputs('case-1'),
    pipeline: makePipeline('completed'),
    createdAt: '2024-03-01T09:00:00.000Z',
    updatedAt: '2024-03-10T10:00:00.000Z',
    currentRun: null,
  },

  {
    id: 'case-2',
    title: 'Ethics in AI',
    status: 'in_review',
    language: 'en',
    contentGoal: 'build_authority',
    goalCustom: null,
    contentStyle: 'professional',
    styleCustom: null,
    contentTargets: ['linkedin','facebook','newsletter','podcast','images'],
    targetAudience: 'Policy makers, AI researchers, and technology-curious general public',
    industry: 'Artificial Intelligence & Policy',
    experienceLevel: 'intermediate',
    writingStyle: 'Balanced, nuanced, journalistic',
    goals: 'Inform audience about emerging AI ethics debates. Foster critical thinking about large action models operating in public spaces.',
    aiInstructions: 'Present multiple perspectives. Avoid taking strong political stances. Cite real examples where possible.',
    schedule: { frequency: 'weekly', time: '08:00', dayOfWeek: 3, dayOfMonth: null },
    sources: [
      src({
        id: 'src-c2-1',
        contentCaseId: 'case-2',
        type: 'url',
        label: 'EU AI Act — Official Overview',
        content: 'https://eur-lex.europa.eu/ai-act',
        createdAt: '2024-02-20T10:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c2-2',
        contentCaseId: 'case-2',
        type: 'text',
        label: 'Background: autonomous agents in public systems',
        content: 'Large action models (LAMs) differ from LLMs in their ability to take real-world actions autonomously — booking appointments, executing code, making purchases. This creates fundamentally new accountability questions that existing AI regulation frameworks were not designed to address.',
        createdAt: '2024-02-22T14:30:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c2-3',
        contentCaseId: 'case-2',
        type: 'pdf',
        label: 'Stanford HAI Ethics Framework 2024',
        content: 'Stanford_HAI_Ethics_2024.pdf',
        createdAt: '2024-02-25T09:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c2-4',
        contentCaseId: 'case-2',
        type: 'url',
        label: 'OpenAI preparedness framework',
        content: 'https://openai.com/safety/preparedness',
        createdAt: '2024-03-01T11:15:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
    ],
    outputs: makeOutputs('case-2').map(o => ({
      ...o,
      id: o.id.replace('case-1', 'case-2'),
      contentCaseId: 'case-2',
      status: 'approved' as const,
    })),
    pipeline: makePipeline('completed'),
    createdAt: '2024-02-20T10:00:00.000Z',
    updatedAt: '2024-03-09T15:00:00.000Z',
    currentRun: null,
  },

  {
    id: 'case-3',
    title: 'Sustainable Energy Futures',
    status: 'generating',
    language: 'en',
    contentGoal: 'build_authority',
    goalCustom: null,
    contentStyle: 'professional',
    styleCustom: null,
    contentTargets: ['linkedin','facebook','newsletter','podcast','images'],
    targetAudience: 'Environmental advocates, policy professionals, and sustainability-focused investors',
    industry: 'Energy & Environment',
    experienceLevel: 'intermediate',
    writingStyle: 'Passionate yet evidence-based; solutions-focused',
    goals: 'Highlight breakthroughs in sustainable energy for small island nations. Build audience for Green Horizon podcast.',
    aiInstructions: 'Emphasize human stories alongside data. Include actionable next steps for readers.',
    schedule: { frequency: 'monthly', time: '10:00', dayOfWeek: null, dayOfMonth: 1 },
    sources: [
      src({
        id: 'src-c3-1',
        contentCaseId: 'case-3',
        type: 'text',
        label: 'Initial notes — solar cost trends',
        content: 'Solar energy costs have dropped 89% in the past decade. Tidal energy is emerging as a reliable baseload source for island nations. Key market: Pacific island nations spending 30–40% of GDP on imported fuel.',
        createdAt: '2024-03-01T08:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c3-2',
        contentCaseId: 'case-3',
        type: 'url',
        label: 'IRENA 2024 Renewables Report',
        content: 'https://irena.org/publications/2024/renewables-cost',
        createdAt: '2024-03-04T13:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
      src({
        id: 'src-c3-3',
        contentCaseId: 'case-3',
        type: 'text',
        label: 'Dr. Elena Rossi interview — tidal energy',
        content: 'Tidal energy predictability is 95%+ accurate 18 months in advance — far better than solar or wind. The Maldives, Samoa, and Fiji are running tidal pilot programs. Estimated ROI: 15 years vs 25 for traditional grid infrastructure.',
        createdAt: '2024-03-08T09:45:00.000Z',
        updatedAt: '2024-03-08T11:00:00.000Z',
        sourceIntelligence: null,
      }),
    ],
    outputs: [],
    pipeline: makePipeline('fact_check'),
    createdAt: '2024-03-01T08:00:00.000Z',
    updatedAt: '2024-03-09T11:00:00.000Z',
    currentRun: null,
  },

  {
    id: 'case-4',
    title: 'Future of Remote Work',
    status: 'research',
    language: 'en',
    contentGoal: 'build_authority',
    goalCustom: null,
    contentStyle: 'professional',
    styleCustom: null,
    contentTargets: ['linkedin','facebook','newsletter','podcast','images'],
    targetAudience: 'HR leaders and remote team managers',
    industry: 'Human Resources & Future of Work',
    experienceLevel: 'intermediate',
    writingStyle: 'Practical and empathetic',
    goals: 'Help managers build better remote cultures. Drive engagement on LinkedIn.',
    aiInstructions: 'Focus on actionable advice. Use case studies. Keep posts under 300 words for social.',
    schedule: { frequency: 'weekly', time: '07:00', dayOfWeek: 5, dayOfMonth: null },
    sources: [
      src({
        id: 'src-c4-1',
        contentCaseId: 'case-4',
        type: 'url',
        label: 'Stanford Remote Work Study 2024',
        content: 'https://stanford.edu/remote-work-2024',
        createdAt: '2024-03-10T09:00:00.000Z',
        updatedAt: null,
        sourceIntelligence: null,
      }),
    ],
    outputs: [],
    pipeline: makePipeline('research'),
    createdAt: '2024-03-10T08:30:00.000Z',
    updatedAt: '2024-03-10T09:00:00.000Z',
    currentRun: null,
  },

  {
    id: 'case-5',
    title: 'Web3 & Creator Economy',
    status: 'draft',
    language: 'en',
    contentGoal: 'build_authority',
    goalCustom: null,
    contentStyle: 'professional',
    styleCustom: null,
    contentTargets: ['linkedin','facebook','newsletter','podcast','images'],
    targetAudience: 'Independent creators and digital entrepreneurs',
    industry: 'Web3 & Creator Economy',
    experienceLevel: 'beginner',
    writingStyle: 'Conversational and energetic',
    goals: 'Demystify Web3 for creators who are curious but intimidated.',
    aiInstructions: 'No jargon without explanation. Use analogies to traditional creative industries.',
    schedule: { frequency: 'manual', time: null, dayOfWeek: null, dayOfMonth: null },
    sources: [],  // No sources yet — case just created, workspace ready for input
    outputs: [],
    pipeline: makePipeline('idle'),
    createdAt: '2024-03-12T14:00:00.000Z',
    updatedAt: '2024-03-12T14:00:00.000Z',
    currentRun: null,
  },
];
