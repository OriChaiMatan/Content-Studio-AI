import type { GeneratorInput } from '../schemas/aiContractSchemas';

// Phase 10C — render the analyst-level discipline so the generator labels the
// strength of each claim, weaves in a counter-argument / alternative, and never
// asserts an overreach. Returns [] when no discipline is present (back-compat).
function disciplineBlock(pa: NonNullable<GeneratorInput['research']['primaryAngle']>, list: (a: string[]) => string): string[] {
  const td = pa.thesisDiscipline;
  if (!td) return [];
  const ev = td.supportingEvidence.map(e => `${e.claim} [${e.strength}${e.sourceRefs.length ? ' · ' + e.sourceRefs.join(',') : ''}]`);
  const ca = td.counterArguments.map(c => `${c.argument} [${c.strength}]`);
  const alt = td.alternativeExplanations.map(a => `${a.explanation} — why plausible: ${a.whyPlausible}`);
  const asmp = td.assumptions.map(a => `${a.assumption} — risk if wrong: ${a.riskIfWrong}`);
  const over = td.overreachWarnings.map(o => `"${o.riskyClaim}" → say instead: "${o.saferWording}"`);
  return [
    '',
    '## THESIS DISCIPLINE (write like a senior analyst — keep the opinion sharp, but label its strength)',
    `Support level: ${td.supportLevel}  ·  Allowed wording strength: ${td.wordingGuidance.allowedStrength}`,
    td.wordingGuidance.requiredQualifiers.length ? `Use these qualifiers for any claim that runs past the evidence: ${td.wordingGuidance.requiredQualifiers.join(', ')}` : '',
    td.wordingGuidance.forbiddenPhrases.length ? `NEVER use these (overconfident / unsupported): ${td.wordingGuidance.forbiddenPhrases.join(', ')}` : '',
    ev.length   ? `Supporting evidence (strongest first):\n${list(ev)}` : '',
    asmp.length ? `Key assumptions (hedge if shaky):\n${list(asmp)}` : '',
    ca.length   ? `Counter-arguments — you MUST weave at least ONE into the body when the thesis is inferred/speculative (not as a disclaimer dump, as part of the analysis):\n${list(ca)}` : '',
    alt.length  ? `Alternative explanations — acknowledge at least one for the same facts:\n${list(alt)}` : '',
    over.length ? `Overreach — do NOT assert the risky version; use the safer wording:\n${list(over)}` : '',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared engine system prompt (Phase 9 CP-2)
// Stable per (platform, language) → cached. Platform instructions are appended
// after this block by each platform spec.
// ─────────────────────────────────────────────────────────────────────────────

export function engineSystem(lang: 'en' | 'he'): string {
  const language = lang === 'he' ? 'Hebrew' : 'English';
  return [
    'You are a platform-native content generation engine for a content studio.',
    '',
    'Your job: produce original, ready-to-publish content for ONE platform, plus its structured breakdown, using ONLY the provided Research Context, Fact Check Report, and Source Intelligence aggregate. You are NOT summarizing the sources — you are creating platform-native content.',
    '',
    'Hard rules:',
    '- When a PRIMARY ANGLE is provided, it is the NARRATIVE SPINE. Build the entire piece around its thesis, and the whole piece must develop THAT story.',
    '- FIRST-PARAGRAPH RULE (critical): the opening must state the SYNTHESIZED INSIGHT — the conclusion that exists ONLY because multiple sources were combined. The first sentence must be IMPOSSIBLE to write from any single source alone. Do NOT open with an announcement, product launch, or the loudest single source as the grammatical subject — never begin with "X announced…", "The WSL…", "Microsoft…", "AI judging…", "AI is changing…", or any single-source recap. Name such a source only AFTER the insight has landed, as supporting evidence.',
    '- Reason like an analyst: Insight → Evidence, NEVER Evidence → Insight. The reader meets the new combined idea first; the individual source facts come second to substantiate it. This rule governs the ARGUMENT STRUCTURE only — the persona, tone, warmth, register, and phrasing are set by the VOICE & STYLE and CUSTOM AI INSTRUCTIONS blocks in the context. Do NOT default to a generic "senior analyst" corporate voice: the SAME thesis must sound different for an executive-analytical case than for a friendly personal-brand or a bold-contrarian case.',
    '- ARGUE, DO NOT SUMMARIZE (critical). The piece is an ARGUMENT for the thesis, not a recap of the sources. Every paragraph must ADVANCE the thesis: state a claim, give the reasoning (why it follows from the combined sources), then the implication. Lead with INTERPRETATION; bring in a fact only to earn a claim, then move the argument forward. Do NOT produce a balanced "on one hand / on the other hand" overview, a neutral news summary, or a bulleted fact-dump. Cite the fewest facts needed — interpretation should outweigh recap.',
    '- OPEN ON THE THESIS: the first 1–2 sentences must state the thesis itself in plain language, reusing its key terms so the reader grasps the core claim immediately — not a teaser, not background, not a source headline.',
    '- THESIS DISCIPLINE (when a THESIS DISCIPLINE block is provided): keep the thesis strong and sharp, but label its confidence honestly. (1) When the angle is inferred or speculative, you MUST weave at least one counter-argument, limitation, or alternative explanation INTO the body as part of the analysis — not as a tacked-on disclaimer. (2) Never present a speculative implication as established fact. (3) Match the allowed wording strength; use the required qualifiers for any claim that runs past the evidence; never use the forbidden phrases; and rewrite any overreach "riskyClaim" using its safer wording. (4) Do NOT collapse into generic neutral hedging or a bland summary — discipline means calibrating the strength of each claim, not deleting the opinion.',
    '- Research facts, claims, and sources are SUPPORT for the angle — use them to substantiate the thesis, not as the headline.',
    '- Fact discipline governs HOW you state a claim (assert / hedge / omit), NOT which story you tell. A thesis resting on an uncertain or inferred claim is still the spine — change the WORDING per its register, never demote the story: assert = state plainly; hedge = "coaches argue…", "early signs suggest…", "reportedly"; speculate = "could…", "one possible implication…", "an emerging question is…".',
    '- Use ONLY facts present in the provided material. Never invent facts, statistics, names, quotes, dates, or events.',
    '- VERIFIED claims are safe to state. HEDGE or OMIT uncertain claims. NEVER state conflicting claims as fact.',
    '- Each platform has a distinct purpose, structure, rhythm, and tone. Follow the platform instructions precisely. Do NOT make every platform sound the same; in particular, Facebook must not read like LinkedIn.',
    `- LANGUAGE: write ALL readyToPublish and breakdown text in ${language}. Proper nouns and product/company/technology names (e.g. Microsoft, Azure, AI, Security Copilot) may stay in their original language. Image-prompt fields must ALWAYS be written in ENGLISH (they feed an image model).`,
    '- readyToPublish must be the final, copy-paste-ready text for the platform. The breakdown must contain the same content decomposed into its named parts (they must be consistent).',
    '- VOICE & STYLE: a VOICE & STYLE block is provided in the context with the target audience, tone/writing style, and goal. Match it precisely — assume the audience\'s context and vocabulary (do not over-explain to experts or under-explain to newcomers), and let the tone/style govern how the piece SOUNDS.',
    '- CUSTOM AI INSTRUCTIONS: when a CUSTOM AI INSTRUCTIONS block is present, it is the user\'s own direction and takes PRECEDENCE on tone, phrasing, and style. It must NEVER override fact discipline, the primary angle/thesis, platform requirements, or the output language — if a custom instruction conflicts with those, follow the fact/thesis/platform/language rule and apply the instruction everywhere else.',
    '- AVOID AI-TELLS: do not use hollow buzzphrases or robotic corporate throat-clearing. Banned outright: "In today\'s rapidly evolving landscape", "in the ever-changing world of", "game changer" / "game-changer", "unlock potential" / "unlock the potential", "the world of X is changing". Use "leverage" only when no plain verb (use / apply / draw on) fits. Never open with a generic scene-setting generality — open on the thesis with concrete specifics.',
    '- Return ONLY the structured result via the provided tool. No preamble, no markdown fences, no extra fields.',
  ].join('\n');
}

// Renders the GeneratorInput projection into the user-turn context block.
// No raw article text — only the curated projection.
export function renderContext(input: GeneratorInput): string {
  const r = input.research;
  const f = input.facts;
  const s = input.sources;
  const b = input.brief;
  const list = (arr: string[]) => (arr.length ? arr.map(x => `- ${x}`).join('\n') : '- (none)');

  // Phase 10B — the narrative spine, placed FIRST so it anchors the whole piece.
  const pa = r.primaryAngle;
  const register = pa?.uncertaintyHandling.register;
  const spine = pa ? [
    '## PRIMARY ANGLE — THE NARRATIVE SPINE (build the entire piece around this)',
    `Thesis: ${pa.thesis}`,
    `Reframe / hook seed: ${pa.reframe}`,
    `Angle type: ${pa.kind}${pa.synthesisBasis.sourceRefs.length ? ` across ${pa.synthesisBasis.sourceRefs.join(', ')}` : ''} — grounding: ${pa.grounding}`,
    pa.tensionPoles ? `Hold BOTH poles in tension — (A) ${pa.tensionPoles.a}  ⟷  (B) ${pa.tensionPoles.b}` : '',
    pa.expertPOV ? `Expert POV (${pa.expertPOV.type}, ${pa.expertPOV.grounding}): ${pa.expertPOV.statement}` : '',
    `Say it as: ${register}  (assert = state plainly · hedge = "coaches argue / early signs suggest" · speculate = "could / one possible implication / an emerging question")`,
    pa.uncertaintyHandling.hedgedClaims.length ? `Hedge these specifically:\n${list(pa.uncertaintyHandling.hedgedClaims)}` : '',
    `Substantiate with (SUPPORT only — do not lead with these, and do NOT open the piece with them):\n${list(pa.supportingFacts)}`,
    `OPENING REQUIREMENT: state the THESIS in sentence 1, in your own words, REUSING its key terms (an insight combining ${pa.synthesisBasis.sourceRefs.length >= 2 ? pa.synthesisBasis.sourceRefs.join('+') : 'the sources'}) — impossible to write from any single source alone. Then DEVELOP it as an argument (claim → why → implication). Introduce a source fact only AFTER the insight, as evidence — never as the first sentence's subject, never as a list.`,
    ...disciplineBlock(pa, list),
    '',
  ] : [];

  // Phase 10E.4 — when a PRIMARY ANGLE exists, the research menu is SUBORDINATE
  // support (deduplicated: keyInsights and suggestedAngles overlap, so only the
  // top supporting points + facts are shown — the generator argues the thesis,
  // it does not pick from a menu). Without an angle, fall back to the fuller menu.
  const researchBlock = pa ? [
    '## SUPPORTING MATERIAL (subordinate to the PRIMARY ANGLE — develop the argument, do NOT list these)',
    `Supporting points:\n${list(r.keyInsights.slice(0, 5))}`,
    `Supporting facts (cite sparingly, only to earn a claim):\n${list(r.importantClaims.slice(0, 6))}`,
    r.contradictions.length ? `Tensions/contradictions to engage (not to avoid):\n${list(r.contradictions.slice(0, 3))}` : '',
  ] : [
    '## RESEARCH CONTEXT',
    `Summary: ${r.summary}`,
    `Main topics:\n${list(r.mainTopics)}`,
    `Key insights:\n${list(r.keyInsights)}`,
    `Important claims:\n${list(r.importantClaims)}`,
    `Suggested angles:\n${list(r.suggestedAngles)}`,
    `Suggested hooks:\n${list(r.suggestedHooks)}`,
    r.contradictions.length ? `Contradictions to avoid:\n${list(r.contradictions)}` : '',
  ];

  return [
    ...spine,
    '## CASE BRIEF',
    `Title: ${b.caseTitle}`,
    `Goal: ${b.contentGoal}${b.goalCustom ? ` (${b.goalCustom})` : ''}${b.goals ? ` — ${b.goals}` : ''}`,
    '',
    '## VOICE & STYLE (match this — it governs HOW the piece sounds, not WHAT it argues)',
    `Tone / writing style: ${b.contentStyle}${b.styleCustom ? ` (${b.styleCustom})` : ''}`,
    b.writingStyle ? `Writing-style notes: ${b.writingStyle}` : '',
    b.targetAudience ? `Target audience: ${b.targetAudience} — write directly for them; assume their context and vocabulary.` : '',
    `Output language: ${b.language ?? input.contract.outputLanguage}`,
    b.aiInstructions
      ? `\n## CUSTOM AI INSTRUCTIONS (user-defined — HIGHEST priority on tone & phrasing; never override facts, the primary angle, platform rules, or language)\n${b.aiInstructions}`
      : '',
    '',
    ...researchBlock,
    `Research confidence: ${r.confidenceScore}/100`,
    '',
    '## FACT CHECK (assertion allowlist / denylist)',
    `VERIFIED (safe to state):\n${list(f.verified.map(c => c.claim))}`,
    `UNCERTAIN (hedge or omit):\n${list(f.uncertain.map(c => c.claim))}`,
    `CONFLICTING (do NOT state as fact):\n${list(f.conflicting)}`,
    f.warnings.length ? `Warnings:\n${list(f.warnings)}` : '',
    `Overall fact-check confidence: ${f.overallConfidenceScore}/100`,
    '',
    '## SOURCE INTELLIGENCE (aggregate)',
    `Entities: ${s.entities.map(e => `${e.name} (${e.type})`).join(', ') || '(none)'}`,
    `Keywords: ${s.keywords.join(', ') || '(none)'}`,
    `Overall sentiment: ${s.sentiment}`,
    `Source count: ${s.sourceCount}`,
  ].filter(Boolean).join('\n');
}
