import type { ContentCase, ContentOutput, ContentSource, PipelineStep } from '../types';

// ── Helpers ───────────────────────────────────────────────

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

function makeOutputs(caseId: string): ContentOutput[] {
  const platforms = ['linkedin', 'facebook', 'instagram', 'newsletter', 'podcast', 'image_prompt'] as const;
  const data: Record<string, { title: string; body: string }> = {
    linkedin: {
      title: 'Quantum Supremacy & Global Logistics',
      body: `The convergence of quantum computing and supply chain optimization is reshaping global trade. \n\nNew algorithms running on quantum hardware are solving routing problems that classical computers take weeks to process — in under 10 minutes. This isn't a distant future. Early adopters in the shipping industry are already reporting 23% reductions in fuel costs.\n\nKey implications for logistics leaders:\n• Dynamic re-routing based on real-time quantum optimization\n• Predictive demand modeling with 40% higher accuracy\n• Reduced last-mile delivery costs through probabilistic scheduling\n\nThe question isn't whether to adopt this technology — it's how fast you can build the internal capability to leverage it.\n\n#QuantumComputing #SupplyChain #FutureOfLogistics`,
    },
    facebook: {
      title: "How Quantum Computers Are Solving the World's Logistics Problem",
      body: `Did you know that quantum computers can solve shipping route problems that would take a classical computer weeks to crack — all in under 10 minutes?\n\nWe dug deep into the research, and the results are staggering. Early adopters in global shipping are already seeing 23% fuel savings and dramatically more accurate demand forecasts.\n\nHere's what's changing:\n✅ Real-time re-routing during disruptions\n✅ Better demand predictions\n✅ Lower delivery costs\n\nThe quantum revolution is here — and it's starting with your supply chain.`,
    },
    instagram: {
      title: 'Quantum × Logistics Visual Story',
      body: `Slide 1: "Your shipping routes are about to get a quantum upgrade 🚢⚛️"\nSlide 2: Classical computers: weeks to solve. Quantum computers: under 10 minutes.\nSlide 3: Real companies are saving 23% on fuel costs RIGHT NOW.\nSlide 4: How? Quantum algorithms + live traffic data + predictive modeling.\nSlide 5: The supply chain of 2026 is being built today.\nSlide 6: Are you ahead of the curve?\nSlide 7: Drop a 💡 if you want a deep-dive thread.\n\n#QuantumComputing #Logistics #Innovation #FutureOfWork #Tech`,
    },
    newsletter: {
      title: 'Weekly Digest: Quantum Computing Meets Global Supply Chain',
      body: `This week, we're exploring one of the most consequential technological intersections of our decade: quantum computing and supply chain optimization.\n\n**What we covered:**\n\nQuantum error correction has crossed a critical threshold, enabling stable long-form calculations on real-world logistics datasets. Three major shipping companies have begun pilot programs, with results suggesting a 15–23% reduction in operational fuel costs — a figure that would translate to billions in savings annually at scale.\n\nThe Silicon Photonics angle: New chip architectures that leverage light instead of electrons are extending quantum coherence times, making practical quantum logistics systems economically viable for the first time.\n\n**What to watch next week:**\nThe EU's proposed regulatory framework for quantum-assisted trade routing decisions — and what it means for compliance teams.\n\n*— Alex Rivera, Lead Researcher*`,
    },
    podcast: {
      title: 'Ep. 38 Outline: Quantum Logistics Revolution',
      body: `EPISODE OUTLINE — "Green Horizon" Episode 38\n\nTitle: "The Quantum Logistics Revolution: How Qubits Are Saving the Planet One Shipping Route at a Time"\n\n[COLD OPEN – 0:00-1:30]\nHook: The container ship that chose its route using a quantum algorithm\n\n[SEGMENT 1 – 1:30-12:00]\nWhat quantum computing actually is (no jargon version)\nGuest intro: Dr. Marcus Chen, MIT Quantum Systems Lab\n\n[SEGMENT 2 – 12:00-28:00]\nThe logistics problem that classical computers can't solve\nHow quantum annealing changes the math\nReal-world pilot results from ShipNext and Maersk Digital\n\n[SEGMENT 3 – 28:00-40:00]\nEnvironmental angle: 23% fuel reduction = real emissions impact\nThe silicon photonics breakthrough\nTimeline: when does this become mainstream?\n\n[CLOSE – 40:00-45:00]\nKey takeaways + listener action items\nNext episode tease`,
    },
    image_prompt: {
      title: 'Visual: Quantum Supply Chain Concept',
      body: `Photorealistic concept illustration, ultra-wide cinematic composition. A vast global logistics network visualized as interconnected light pathways over a dark Earth map. Quantum probability clouds (soft blue-violet glows) emanate from major port cities — Shanghai, Rotterdam, Los Angeles. Container ships rendered as luminous data packets traveling along optimized golden routing lines. In the foreground, a translucent quantum processor chip with visible qubit lattice structure floats above the scene. The overall palette is deep navy, electric blue, and warm amber. The mood is technological optimism — powerful, precise, and globally interconnected. Style: Blend of scientific visualization and editorial design illustration. Aspect ratio: 16:9.`,
    },
  };

  return platforms.map((platform, i) => ({
    id: `output-${caseId}-${platform}`,
    contentCaseId: caseId,
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

function makeSources(caseId: string): ContentSource[] {
  return [
    {
      id: `src-${caseId}-1`,
      contentCaseId: caseId,
      type: 'text',
      label: 'Background notes',
      content: 'Quantum computing breakthroughs in 2024 have focused on error correction (Google Willow chip achieving 105 qubits with sub-threshold error rates) and practical applications in optimization problems including supply chain routing, drug discovery, and financial modeling.',
      createdAt: '2024-03-08T09:00:00.000Z',
    },
    {
      id: `src-${caseId}-2`,
      contentCaseId: caseId,
      type: 'url',
      label: 'MIT Technology Review',
      content: 'https://www.technologyreview.com/2024/quantum-logistics',
      createdAt: '2024-03-08T09:05:00.000Z',
    },
    {
      id: `src-${caseId}-3`,
      contentCaseId: caseId,
      type: 'pdf',
      label: 'Q1 Research Report.pdf',
      content: 'Q1 Research Report.pdf',
      createdAt: '2024-03-08T09:10:00.000Z',
    },
  ];
}

// ── Mock Cases ─────────────────────────────────────────────

export const mockContentCases: ContentCase[] = [
  {
    id: 'case-1',
    title: 'Quantum Computing 2024',
    status: 'in_review',
    language: 'en',
    targetAudience: 'Logistics executives and supply chain managers at Fortune 500 companies',
    industry: 'Technology & Logistics',
    experienceLevel: 'expert',
    writingStyle: 'Authoritative and data-driven with accessible analogies',
    goals: 'Position our team as thought leaders in quantum applications for enterprise logistics. Drive newsletter signups and LinkedIn engagement.',
    aiInstructions: 'Avoid excessive jargon. Always ground claims in cited research. Maintain a tone that is optimistic but not hyperbolic. Use active voice.',
    schedule: { frequency: 'weekly', time: '09:00', dayOfWeek: 1, dayOfMonth: null },
    sources: makeSources('case-1'),
    outputs: makeOutputs('case-1'),
    pipeline: makePipeline('completed'),
    createdAt: '2024-03-08T09:00:00.000Z',
    updatedAt: '2024-03-10T10:00:00.000Z',
  },
  {
    id: 'case-2',
    title: 'Ethics in AI',
    status: 'in_review',
    language: 'en',
    targetAudience: 'Policy makers, AI researchers, and technology-curious general public',
    industry: 'Artificial Intelligence & Policy',
    experienceLevel: 'intermediate',
    writingStyle: 'Balanced, nuanced, journalistic',
    goals: 'Inform audience about emerging AI ethics debates. Foster critical thinking about large action models operating in public spaces.',
    aiInstructions: 'Present multiple perspectives. Avoid taking strong political stances. Cite real examples where possible.',
    schedule: { frequency: 'weekly', time: '08:00', dayOfWeek: 3, dayOfMonth: null },
    sources: [
      {
        id: 'src-case2-1',
        contentCaseId: 'case-2',
        type: 'url',
        label: 'EU AI Act Overview',
        content: 'https://eur-lex.europa.eu/ai-act',
        createdAt: '2024-03-05T10:00:00.000Z',
      },
    ],
    outputs: makeOutputs('case-2').map(o => ({ ...o, id: o.id.replace('case-1', 'case-2'), contentCaseId: 'case-2', status: 'approved' as const })),
    pipeline: makePipeline('completed'),
    createdAt: '2024-03-05T10:00:00.000Z',
    updatedAt: '2024-03-09T15:00:00.000Z',
  },
  {
    id: 'case-3',
    title: 'Sustainable Energy Futures',
    status: 'generating',
    language: 'en',
    targetAudience: 'Environmental advocates, policy professionals, and sustainability-focused investors',
    industry: 'Energy & Environment',
    experienceLevel: 'intermediate',
    writingStyle: 'Passionate yet evidence-based; solutions-focused',
    goals: 'Highlight breakthroughs in sustainable energy for small island nations. Build audience for Green Horizon podcast.',
    aiInstructions: 'Emphasize human stories alongside data. Include actionable next steps for readers.',
    schedule: { frequency: 'monthly', time: '10:00', dayOfWeek: null, dayOfMonth: 1 },
    sources: [
      {
        id: 'src-case3-1',
        contentCaseId: 'case-3',
        type: 'text',
        label: 'Research notes',
        content: 'Solar energy costs have dropped 89% in the past decade. Tidal energy is emerging as a reliable baseload source for island nations.',
        createdAt: '2024-03-09T08:00:00.000Z',
      },
    ],
    outputs: [],
    pipeline: makePipeline('fact_check'),
    createdAt: '2024-03-09T08:00:00.000Z',
    updatedAt: '2024-03-09T11:00:00.000Z',
  },
  {
    id: 'case-4',
    title: 'Future of Remote Work',
    status: 'research',
    language: 'en',
    targetAudience: 'HR leaders and remote team managers',
    industry: 'Human Resources & Future of Work',
    experienceLevel: 'intermediate',
    writingStyle: 'Practical and empathetic',
    goals: 'Help managers build better remote cultures. Drive engagement on LinkedIn.',
    aiInstructions: 'Focus on actionable advice. Use case studies. Keep posts under 300 words for social.',
    schedule: { frequency: 'weekly', time: '07:00', dayOfWeek: 5, dayOfMonth: null },
    sources: [],
    outputs: [],
    pipeline: makePipeline('research'),
    createdAt: '2024-03-11T09:00:00.000Z',
    updatedAt: '2024-03-11T09:30:00.000Z',
  },
  {
    id: 'case-5',
    title: 'Web3 & Creator Economy',
    status: 'draft',
    language: 'en',
    targetAudience: 'Independent creators and digital entrepreneurs',
    industry: 'Web3 & Creator Economy',
    experienceLevel: 'beginner',
    writingStyle: 'Conversational and energetic',
    goals: 'Demystify Web3 for creators who are curious but intimidated.',
    aiInstructions: 'No jargon without explanation. Use analogies to traditional creative industries.',
    schedule: { frequency: 'manual', time: null, dayOfWeek: null, dayOfMonth: null },
    sources: [],
    outputs: [],
    pipeline: makePipeline('idle'),
    createdAt: '2024-03-12T14:00:00.000Z',
    updatedAt: '2024-03-12T14:00:00.000Z',
  },
];
