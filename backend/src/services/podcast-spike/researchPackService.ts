import type Anthropic from '@anthropic-ai/sdk';
import type { ResearchContextV2, FactCheckReport } from '../../schemas/aiContractSchemas';
import type { ResearchPack, StageTelemetry } from './podcastSpikeTypes';
import { getSpikeClient, SPIKE_MODEL, extractToolInput, recordTelemetry } from './spikeClient';

// Stage 1: Distill a v2 ResearchContext + FactCheckReport into a compact ResearchPack.
// The Pack is the source of truth for everything downstream — the narrator must never
// invent facts outside it.

const PACK_TOOL_NAME = 'emit_research_pack';

const PACK_TOOL: Anthropic.Tool = {
  name: PACK_TOOL_NAME,
  description: 'Emit the distilled ResearchPack — the source of truth for the podcast episode.',
  input_schema: {
    type: 'object' as const,
    required: [
      'thesis', 'audience', 'language', 'claims', 'keyFacts', 'keyNumbers',
      'importantEntities', 'sourceRefs', 'counterarguments', 'openQuestions',
      'researchDensity', 'podcastRecommendation', 'researchNotes',
    ],
    properties: {
      thesis: { type: 'string', description: 'The single-sentence narrative spine of the episode.' },
      audience: { type: 'string' },
      language: { type: 'string', enum: ['en', 'he'] },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          required: ['text', 'confidence'],
          properties: {
            text: { type: 'string' },
            confidence: { type: 'string', enum: ['verified', 'reported', 'uncertain'] },
            sourceRef: { type: 'string' },
          },
        },
      },
      keyFacts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific, citable facts the narrator can use. Include exact numbers.',
      },
      keyNumbers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific quantitative claims (percentages, dates, statistics).',
      },
      importantEntities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Companies, people, products, concepts central to the story.',
      },
      sourceRefs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short labels for each source. IMPORTANT: Every source referenced in any claim\'s sourceRef must appear here. If a claim cites "S2: Zuora", that label must appear in this array.',
      },
      counterarguments: {
        type: 'array',
        items: { type: 'string' },
        description: 'Arguments that challenge the thesis. The episode must engage at least one.',
      },
      openQuestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Genuine unresolved questions the episode should acknowledge honestly.',
      },
      researchDensity: {
        type: 'string',
        enum: ['high', 'medium', 'limited'],
        description: 'high = many verified facts, strong thesis; medium = reasonable; limited = thin/speculative.',
      },
      podcastRecommendation: {
        type: 'object',
        required: ['verdict', 'reason'],
        properties: {
          verdict: { type: 'string', enum: ['recommended', 'not-recommended'] },
          reason: { type: 'string', description: 'One sentence explaining the density verdict.' },
        },
      },
      researchNotes: {
        type: 'object',
        required: ['verifiedFacts', 'primarySources', 'importantEntities', 'openQuestions', 'lowerConfidenceClaims'],
        description: 'Creator-facing transparency panel — not spoken in the episode.',
        properties: {
          verifiedFacts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fact'],
              properties: {
                fact: { type: 'string' },
                source: { type: 'string' },
              },
            },
          },
          primarySources: { type: 'array', items: { type: 'string' } },
          importantEntities: { type: 'array', items: { type: 'string' } },
          openQuestions: { type: 'array', items: { type: 'string' } },
          lowerConfidenceClaims: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

function formatResearchInput(
  rc: ResearchContextV2,
  fcr: FactCheckReport,
  caseAudience: string,
): string {
  const lines: string[] = [];

  const thesis = rc.synthesis.primaryAngle?.thesis
    ?? rc.synthesis.mainStory.headline;
  lines.push(`THESIS: ${thesis}`);
  lines.push(`STORY: ${rc.synthesis.mainStory.summary}`);
  lines.push(`LANGUAGE: ${rc.language}`);
  lines.push(`AUDIENCE: ${caseAudience || 'general professional audience'}`);
  lines.push(`SOURCES: ${rc.meta.sourceCount} (primary: ${rc.meta.primarySourceCount})`);
  lines.push(`OVERALL CONFIDENCE: ${rc.confidenceScore}/100`);
  lines.push('');

  // Cap at top 8 facts by confidence to keep input bounded
  const topFacts = [...rc.knowledge.keyFacts]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
  if (topFacts.length > 0) {
    lines.push('KEY FACTS:');
    for (const f of topFacts) {
      lines.push(`  [${f.status} conf:${f.confidence}] ${f.statement}`);
    }
    lines.push('');
  }

  if (rc.knowledge.coreSubjects.length > 0) {
    lines.push('KEY ENTITIES:');
    for (const s of rc.knowledge.coreSubjects.slice(0, 6)) {
      lines.push(`  ${s.name} (${s.type}): ${s.role}`);
    }
    lines.push('');
  }

  if (rc.synthesis.tensions.length > 0) {
    lines.push('TENSIONS:');
    for (const t of rc.synthesis.tensions.slice(0, 3)) {
      lines.push(`  ${t.description}`);
      lines.push(`    [A] ${t.poles[0]}  vs  [B] ${t.poles[1]}`);
    }
    lines.push('');
  }

  if (rc.synthesis.contradictions.length > 0) {
    lines.push('CONTRADICTIONS:');
    for (const c of rc.synthesis.contradictions.slice(0, 3)) {
      lines.push(`  ${c.subject}: "${c.claimA}" vs "${c.claimB}" (${c.nature})`);
    }
    lines.push('');
  }

  if (rc.synthesis.openQuestions.length > 0) {
    lines.push('OPEN QUESTIONS:');
    for (const q of rc.synthesis.openQuestions.slice(0, 5)) {
      lines.push(`  - ${q}`);
    }
    lines.push('');
  }

  if (rc.synthesis.nonObviousInsights.length > 0) {
    lines.push('NON-OBVIOUS INSIGHTS:');
    for (const ins of rc.synthesis.nonObviousInsights.slice(0, 3)) {
      lines.push(`  [${ins.lens}] ${ins.insight}`);
    }
    lines.push('');
  }

  if (rc.sourceReferences.length > 0) {
    lines.push(`SOURCE REFS: ${rc.sourceReferences.join(' | ')}`);
    lines.push('');
  }

  lines.push('FACT CHECK SUMMARY:');
  lines.push(`  Integrity score: ${fcr.integrityScore}   Risk level: ${fcr.riskLevel}`);
  const topVerified = fcr.verifiedClaims.slice(0, 6);
  if (topVerified.length > 0) {
    lines.push(`  Verified (${fcr.verifiedClaims.length} total, showing top ${topVerified.length}):`);
    for (const c of topVerified) {
      lines.push(`    ✓ ${c.claim} [conf:${c.confidenceScore}]`);
    }
  }
  const topUncertain = fcr.uncertainClaims.slice(0, 4);
  if (topUncertain.length > 0) {
    lines.push(`  Uncertain (${fcr.uncertainClaims.length} total, showing top ${topUncertain.length}):`);
    for (const c of topUncertain) {
      lines.push(`    ? ${c.claim}`);
    }
  }
  if (fcr.conflictingClaims.length > 0) {
    lines.push(`  Conflicting (${fcr.conflictingClaims.length}): ${fcr.conflictingClaims.map(c => c.claim).slice(0, 2).join('; ')}`);
  }
  if (fcr.editorialWarnings && fcr.editorialWarnings.length > 0) {
    lines.push(`  Editorial warnings: ${fcr.editorialWarnings.slice(0, 3).join('; ')}`);
  }

  return lines.join('\n');
}

export async function buildResearchPack(
  rc: ResearchContextV2,
  fcr: FactCheckReport,
  caseAudience: string,
  stageTelemetry: StageTelemetry[],
): Promise<ResearchPack> {
  const client = getSpikeClient();
  const formatted = formatResearchInput(rc, fcr, caseAudience);

  const systemPrompt = `You are a research analyst preparing the source-of-truth document for a podcast episode.

Your job: distill the research context into a compact ResearchPack.

Rules:
- Capture the thesis EXACTLY as argued in the research — do not soften or reframe it
- Every claim must trace back to the input material
- Do NOT invent any facts, numbers, or entities not present in the input
- researchDensity is honest: if the research is thin or speculative, say "limited"
- The researchNotes are creator-facing transparency — not spoken in the episode
- Claims confidence: "verified" = fact-checked as true, "reported" = stated by source not independently confirmed, "uncertain" = contested or speculative
- keyNumbers should include any specific percentages, dates, timeframes, or statistics mentioned. If there are no specific numeric claims, leave keyNumbers empty — do not fabricate numbers.
- SOURCE ATTRIBUTION: Every source label referenced in a claim's sourceRef MUST appear in the top-level sourceRefs array. Scan all claims and ensure every cited source is present in sourceRefs. Missing sourceRefs cause narrator hallucination.`;

  const userContent = `Research input:\n\n${formatted}\n\nDistill this into a ResearchPack.`;

  const t0 = Date.now();
  const message = await client.messages.create(
    {
      model: SPIKE_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      tools: [PACK_TOOL],
      tool_choice: { type: 'tool', name: PACK_TOOL_NAME },
      messages: [{ role: 'user', content: userContent }],
    },
    { timeout: 150_000 },
  );

  stageTelemetry.push(recordTelemetry('research-pack', message, Date.now() - t0));

  const raw = extractToolInput(message, PACK_TOOL_NAME);
  return raw as unknown as ResearchPack;
}
