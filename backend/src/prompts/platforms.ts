import Anthropic from '@anthropic-ai/sdk';
import { contentGenerationConfig } from '../lib/anthropic';
import {
  GeneratedOutputSchema,
  LinkedInBreakdownSchema,
  FacebookBreakdownSchema,
  NewsletterBreakdownSchema,
  type GeneratedOutput,
  type GeneratorInput,
  type ContentPlatform,
} from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Platform specs (Phase 9 CP-2)
//
// Claude returns the structured BREAKDOWN only (via a forced tool). The service
// validates it with the v2 Zod schemas and DETERMINISTICALLY assembles
// readyToPublish from the breakdown — this avoids asking Claude to duplicate the
// whole post (which doubled tokens and risked an empty readyToPublish) and keeps
// readyToPublish consistent with the breakdown.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformSpec {
  instruction: string;
  tool: Anthropic.Tool;
  maxTokens: number;
  longform: boolean;
  finalize: (raw: Record<string, unknown>, input: GeneratorInput) => GeneratedOutput;
}

const SEP = '─────────────────────────────────';


function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function baseMeta(input: GeneratorInput, extra: Record<string, unknown> = {}) {
  return {
    generatorVersion: 'claude-gen-1',
    model:            contentGenerationConfig.model,
    degraded:         false,
    // Phase 10D.0 — carry upstream research degradation onto the output.
    researchDegraded:         input.contract.researchDegraded === true,
    researchGeneratorVersion: input.contract.researchGeneratorVersion,
    // Phase 10E.3 — contentScore is NO LONGER a research/fact-check confidence
    // average (which never measured the prose). It is set post-generation to the
    // measured Thesis Preservation Score. researchConfidence / factCheckAccuracy
    // remain as honest INPUT-confidence signals, kept separate from quality.
    contentScore:     null,
    researchConfidence: input.research.confidenceScore,
    factCheckAccuracy:  input.facts.overallConfidenceScore,
    ...extra,
  };
}

const str = (v: unknown) => String(v ?? '');
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

// Phase 11D.4 — LinkedIn deterministic length-repair helpers (sentence-aware, EN+He).
const splitSentences = (t: string): string[] => t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
const normSentence  = (s: string): string => s.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/u, '').toLowerCase();

// Phase 11D.5 — rendering normalizers.
// (a) Strip a leading list enumerator the model sometimes bakes into a takeaway
//     ("1. ", "1) ", "1- ", "- ", "• ") so the assembler's own numbering does not
//     produce "1. 1. …". Never returns empty (keeps the original if a strip would).
const stripLeadingEnumerator = (s: string): string => {
  const out = s.replace(/^\s*(?:\d+\s*[.)\-]\s*|[-–—•*]\s*)+/, '').trim();
  return out || s.trim();
};
// (b) Render topics as real hashtags: ensure exactly one leading '#', no internal
//     whitespace, and drop case-insensitive duplicates. The model emits bare topics
//     ("IdentitySecurity"); assembly is responsible for the '#'. Handles already-'#'ed
//     and spaced inputs idempotently.
const normalizeHashtags = (arr: string[]): string[] => {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of arr) {
    const bare = String(raw).replace(/^#+/, '').replace(/\s+/g, '');
    if (!bare) continue;
    const key = bare.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); out.push('#' + bare);
  }
  return out;
};

// Phase L3 — LinkedIn hashtags are mandatory (3–6). Use the model's tags first; if it
// returned fewer than 3, DETERMINISTICALLY backfill from already-available research /
// source metadata (NO extra LLM call): keywords → main topics → entity names → case
// title tokens. Capped at 6. (LinkedIn only.)
function linkedinHashtags(modelTags: string[], input: GeneratorInput): string[] {
  // Strip ALL non-alphanumerics (hyphens, punctuation) so a multi-word topic like
  // "On-call Health" becomes "#OncallHealth", not the broken "#On-callHealth".
  const clean = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');
  const model = normalizeHashtags(modelTags.map(clean)).slice(0, 5);   // Phase L4 — 3–5
  if (model.length >= 3) return model;
  const pool = [
    ...model,
    ...input.sources.keywords,
    ...input.research.mainTopics,
    ...input.sources.entities.map(e => e.name),
    ...input.brief.caseTitle.split(/\s+/),
  ].map(clean);
  return normalizeHashtags(pool).slice(0, 5);
}

export const PLATFORM_SPECS: Record<ContentPlatform, PlatformSpec> = {
  // ── LinkedIn ────────────────────────────────────────────────────────────────
  linkedin: {
    maxTokens: 1500,
    longform: false,
    instruction: [
      'PLATFORM: LinkedIn — a high-performing FEED POST. NOT an essay, newsletter, report, or thought-leadership column. One sharp idea, argued with conviction. A busy professional is scrolling fast — earn the stop in the first line. NO emoji by default.',
      'VOICE: write like a sharp founder, operator, or industry columnist talking to peers — a real person with a point of view and skin in the game. NOT an academic, analyst, consultant, or report writer. Plain, direct, human.',
      'HOOK — the first line is everything; it shows ALONE in the feed before "…see more", so it must stop the scroll on its own. Express the THESIS as exactly ONE of these: (1) Contrarian claim — "everyone believes X; the opposite is true"; (2) Paradox; (3) Uncomfortable truth; (4) Strong opinion; (5) Surprising insight. Concrete and specific (a real tension, a named shift, a number) — not vague. ≤ ~100 chars, one line, no emoji, no hashtags. It must still BE the thesis — sharpened.',
      'ONE THESIS ONLY — argue a SINGLE thesis end to end. Do NOT merge two angles. If the material holds two tensions, pick the STRONGER one and use the other only as a minor support point — never let it grow into a second thesis. The hook, insight, takeaway, and CTA must ALL serve the SAME thesis.',
      'PRIMARY SOURCES DOMINATE — build the core argument from the PRIMARY ANGLE thesis and its supporting facts. Peripheral or secondary details (match scores, attendance numbers, side events, location trivia) are TEXTURE at most: use one sparingly, if at all, and NEVER as the central evidence. Do not introduce a claim that rests only on secondary details.',
      'ARGUE, DO NOT SUMMARIZE — develop the argument: claim → why it holds → the implication. Lead with interpretation; bring a fact only to earn a claim. No balanced overview, no recap.',
      'LANGUAGE — concrete and human. Plain words a smart operator uses on the job. Short sentences (≤ ~20 words). Prefer the pattern "They say X. The behavior says Y. That is the tension." over analyst phrasing. Anchor every abstract claim to a concrete consequence — no floating concepts. Rewrite report-speak as plain lines, e.g. "This is not just a kit rule — it decides what counts."',
      'INSIGHT STRUCTURE (strict): the insight section MUST be 2–3 SEPARATE paragraphs, each separated by a BLANK LINE, each at most 2 sentences. Each paragraph does ONE job — create tension, add insight, or deepen engagement. Never one dense block / wall of text.',
      'BANNED — never use these or their equivalents in ANY language (English or Hebrew). (a) Fluff: "AI is changing everything", "In today\'s world", "The future belongs to", "Now more than ever", "game-changer", "Here are N lessons", generic motivational lines. (b) Academic register: "narrative", "paradox", "symbolic", "mechanism", "legitimacy", "monopoly", "framework", "structural", "lens", "ecosystem". (c) Analyst/report phrases: "the evidence suggests", "it is difficult to separate", "central pillar", "market penetration", "commercial strategy", "regulatory framework", "symbolic mechanism", "institutional logic" — and Hebrew equivalents (e.g. "הראיות מצביעות", "נדבך מרכזי", "אסטרטגיה מסחרית", "חדירה לשוק"). If a sentence sounds like a report, rewrite it as something a person would actually say.',
      'CTA — ONE sharp line (≤ ~90 chars) that provokes real professional discussion: take a side, pose a concrete either/or, or name the decision the reader faces. NOT "Thoughts?", NOT "Agree?", NOT a sales pitch.',
      'HASHTAGS — 3–5, relevant to the thesis: a mix of broad + niche/topical + the specific subject. No spam tags (#motivation, #success, #viral). Use a 6th only if it is clearly useful.',
      'HARD LENGTH: target 850–1050 characters; hard limit 650–1400. Hook ≤100; context = 1 short paragraph; cta ≤90. Density beats length — aim well under the ceiling, every line earns its place.',
      '"takeaways" here means SHARP IMPLICATIONS or CONSEQUENCES of the thesis — NOT lessons, summaries, or advice. OPTIONAL: include 0–2 only if each is a standalone punch-line that advances the SAME thesis; if a list would dilute the post, OMIT it (empty). Never label or number them.',
      'Return the breakdown: hook, context (≤1 short paragraph), insight (2–3 blank-line-separated paragraphs, ≤2 sentences each), takeaways (0–2, optional), cta, hashtags (3–5).',
    ].join('\n'),
    tool: {
      name: 'record_linkedin_content',
      description: 'Record the LinkedIn breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' }, context: { type: 'string' }, insight: { type: 'string' },
          takeaways: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 2, description: 'OPTIONAL (0–2): sharp implications/consequences of the SAME thesis, NOT lessons/summaries/advice. Omit (empty) if a list would dilute the post.' },
          cta: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5, description: '3–5 hashtags relevant to the thesis: mix broad + niche/topical + the specific subject. No spam tags (#motivation, #success, #viral).' },
        },
        required: ['hook', 'context', 'insight', 'cta', 'hashtags'],
      },
    },
    finalize: (raw, input) => {
      let breakdown = LinkedInBreakdownSchema.parse({
        hook: str(raw.hook), context: str(raw.context), insight: str(raw.insight),
        // Phase 11D.5 — strip any leading enumerator. Phase L2/L4 — takeaways are OPTIONAL
        // implications/consequences: cap to 2, keep the breakdown consistent with the
        // de-numbered render below (empty array when the model omits them).
        takeaways: strArr(raw.takeaways).map(stripLeadingEnumerator).slice(0, 2),
        cta: str(raw.cta),
        // Phase 11D.5 — '#'-prefixed, de-duped. Phase L3 — mandatory 3–6 via deterministic
        // backfill from research/source metadata when the model returns fewer than 3.
        hashtags: linkedinHashtags(strArr(raw.hashtags), input),
      });
      // Phase L2 — render takeaways as plain standalone lines (NO "1. 2. 3." numbering),
      // and ONLY when present — so a sharp single-argument post is not forced into a
      // "N lessons" listicle. LinkedIn assembler only; other platforms are untouched.
      const assemble = (bd: typeof breakdown) => [
        bd.hook, '', bd.context, '', bd.insight,
        ...(bd.takeaways.length ? ['', bd.takeaways.join('\n')] : []),
        '', bd.cta,
        ...(bd.hashtags.length ? ['', bd.hashtags.join(' ')] : []),
      ].join('\n').trim();

      let readyToPublish = assemble(breakdown);
      const originalLen = readyToPublish.length;
      let linkedinLengthRepaired = false;
      let duplicateSentencesRemoved = 0;

      // Phase 11D.4 — DETERMINISTIC small/medium overage repair (1401–1900 chars), NO
      // Claude call. Preserves the hook + core insight (thesis & synthesis narrative);
      // removes duplicate sentences, then trims the lowest-value elements in order
      // (extra takeaways → cta tail → context tail → insight paragraphs/tail) until ≤1400
      // and ≥650 chars. Phase L3 — hashtags are mandatory and are NEVER dropped here.
      // Over 1900 (or under 650) → fall through to the existing corrective retry.
      if (readyToPublish.length > 1400 && readyToPublish.length <= 1900) {
        const rep = { ...breakdown, takeaways: [...breakdown.takeaways], hashtags: [...breakdown.hashtags] };

        // (1) Duplicate-sentence cleanup — the live fallback repeated an insight sentence.
        const seen = new Set<string>();
        [...splitSentences(rep.hook), ...splitSentences(rep.context)].forEach(s => seen.add(normSentence(s)));
        // Phase L3 — dedup PER PARAGRAPH and rejoin with blank lines, so the strict
        // 2–4 paragraph insight rhythm survives the repair (was: flatten to one block).
        const insParas = rep.insight.split(/\n\s*\n/).map(p => {
          const kept: string[] = [];
          for (const s of splitSentences(p)) {
            const n = normSentence(s);
            if (n && !seen.has(n)) { seen.add(n); kept.push(s); } else if (n) duplicateSentencesRemoved++;
          }
          return kept.join(' ').trim();
        }).filter(Boolean);
        if (insParas.length) rep.insight = insParas.join('\n\n');
        const keptTk: string[] = []; const tkSeen = new Set<string>();
        for (const tk of rep.takeaways) {
          const n = normSentence(tk);
          if (n && !seen.has(n) && !tkSeen.has(n)) { tkSeen.add(n); keptTk.push(tk); } else if (n) duplicateSentencesRemoved++;
        }
        if (keptTk.length) rep.takeaways = keptTk;

        // (2) Progressive trimming of the lowest-value elements, re-checking each time.
        // Phase L3 — hashtags are now MANDATORY (3–6): never drop them here. Trim the
        // optional takeaways and prose tails instead (they save far more length anyway).
        let cur = assemble(rep).length;
        while (cur > 1400 && rep.takeaways.length > 3) { rep.takeaways = rep.takeaways.slice(0, -1); cur = assemble(rep).length; }
        if (cur > 1400) { const first = splitSentences(rep.cta)[0]; if (first && first.length < rep.cta.length) { rep.cta = first; cur = assemble(rep).length; } }
        while (cur > 1400) { const cs = splitSentences(rep.context); if (cs.length <= 1) break; rep.context = cs.slice(0, -1).join(' '); cur = assemble(rep).length; }
        // Phase L3 — trim the insight by DROPPING trailing paragraphs first (preserving
        // the blank-line rhythm down to one paragraph), only then sentence-trim the last.
        while (cur > 1400) {
          const ps = rep.insight.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
          if (ps.length > 1) { rep.insight = ps.slice(0, -1).join('\n\n'); cur = assemble(rep).length; continue; }
          const is = splitSentences(rep.insight); if (is.length <= 1) break;
          rep.insight = is.slice(0, -1).join(' '); cur = assemble(rep).length;
        }
        while (cur > 1400 && rep.takeaways.length > 1) { rep.takeaways = rep.takeaways.slice(0, -1); cur = assemble(rep).length; }

        // Accept the repair only if it landed in range; otherwise keep the original and
        // let the existing gate fire (retry). Re-validate the breakdown shape too.
        if (cur >= 650 && cur <= 1400) {
          const parsed = LinkedInBreakdownSchema.safeParse(rep);
          if (parsed.success) {
            breakdown = parsed.data;
            readyToPublish = assemble(breakdown);
            linkedinLengthRepaired = true;
            console.warn(`[contentGen:linkedin] length ${originalLen}→${readyToPublish.length} chars — deterministically repaired (${duplicateSentencesRemoved} duplicate sentence(s) removed, no Claude retry).`);
          }
        }
      }

      // HARD length rule (LinkedIn only): 650–1400 chars. Out-of-range (after any
      // deterministic repair) fails validation → corrective retry → if still out-of-range,
      // the service returns a v2 mock fallback. No silent over-length acceptance.
      const len = readyToPublish.length;
      if (len < 650 || len > 1400) {
        throw new Error(
          len > 1400
            ? `LinkedIn assembled post is ${len} characters — OVER the limit (valid 650–1400; aim for ~950, NOT the 1400 ceiling). ` +
              `Cut at least ${len - 950} characters: tighten the hook to one line, keep context to 1 short paragraph, tighten the insight (keep 2–3 short paragraphs of ≤2 sentences — drop the weakest one rather than merging them), ` +
              `drop or shorten the OPTIONAL takeaways (omit them if they dilute), and a short cta. Preserve the PRIMARY ANGLE thesis and the synthesis-driven narrative — ` +
              `remove wordiness and repetition, NOT the core story.`
            : `LinkedIn assembled post is ${len} characters — UNDER the minimum (valid 650–1400; aim for ~950). ` +
              `Add 1–2 substantive sentences to the insight while keeping the same PRIMARY ANGLE and 2–3 short paragraphs.`,
        );
      }
      return GeneratedOutputSchema.parse({
        platform: 'linkedin', title: input.brief.caseTitle, readyToPublish, breakdown,
        metadata: baseMeta(input, { hashtags: breakdown.hashtags, ...(linkedinLengthRepaired ? { linkedinLengthRepaired: true } : {}) }),
      });
    },
  },

  // ── Facebook ──────────────────────────────────────────────────────────────
  facebook: {
    maxTokens: 1500,
    longform: false,
    instruction: [
      'PLATFORM: Facebook. Purpose: community, conversation, human tone.',
      'Tone: warm, personal, conversational — must NOT read like LinkedIn. First person welcome.',
      'Length: around 150–500 words.',
      'Return the breakdown: hook, story, personalInterpretation, communityQuestion, hashtags (0–2).',
    ].join('\n'),
    tool: {
      name: 'record_facebook_content',
      description: 'Record the Facebook breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' }, story: { type: 'string' }, personalInterpretation: { type: 'string' },
          communityQuestion: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 2 },
        },
        required: ['hook', 'story', 'personalInterpretation', 'communityQuestion', 'hashtags'],
      },
    },
    finalize: (raw, input) => {
      const breakdown = FacebookBreakdownSchema.parse({
        hook: str(raw.hook), story: str(raw.story), personalInterpretation: str(raw.personalInterpretation),
        // Phase 11D.5 — same '#'-rendering fix as LinkedIn.
        communityQuestion: str(raw.communityQuestion), hashtags: normalizeHashtags(strArr(raw.hashtags)),
      });
      const readyToPublish = [
        breakdown.hook, '', breakdown.story, '', breakdown.personalInterpretation, '',
        breakdown.communityQuestion, ...(breakdown.hashtags.length ? ['', breakdown.hashtags.join(' ')] : []),
      ].join('\n').trim();
      return GeneratedOutputSchema.parse({
        platform: 'facebook', title: input.brief.caseTitle, readyToPublish, breakdown,
        metadata: baseMeta(input, { hashtags: breakdown.hashtags }),
      });
    },
  },

  // ── Newsletter ────────────────────────────────────────────────────────────
  newsletter: {
    // Phase 11D.2 — was a hardcoded 4000 (truncated complete Hebrew newsletters →
    // retry → mock fallback). Now env-configurable; default 8000. See contentGenerationConfig.
    maxTokens: contentGenerationConfig.newsletterMaxTokens,
    longform: true,
    instruction: [
      'PLATFORM: Newsletter. Purpose: education and analysis. Analytical, not salesy.',
      'mainAnalysis must ARGUE the thesis (claim → reasoning → implication) and engage the tension/counter-argument head-on — it is NOT a survey of the topic or a summary of the sources. Open on the thesis; let interpretation drive; cite facts only to earn each claim.',
      'Length: around 600–1200 words (mainAnalysis is the substantial body).',
      'Return the breakdown: subject, previewText, opening, mainAnalysis, practicalTakeaways, closingInsight, cta. No image prompt.',
      // Phase 11D.3 — make the required array explicit so it is never returned empty.
      'practicalTakeaways is REQUIRED and must NEVER be empty: always provide 3–6 concrete, actionable takeaways, each a complete non-blank phrase. Do not omit this array, do not return [], and do not include empty strings.',
    ].join('\n'),
    tool: {
      name: 'record_newsletter_content',
      description: 'Record the newsletter breakdown.',
      input_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' }, previewText: { type: 'string' }, opening: { type: 'string' },
          mainAnalysis: { type: 'string' },
          practicalTakeaways: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
          closingInsight: { type: 'string' }, cta: { type: 'string' },
        },
        required: ['subject', 'previewText', 'opening', 'mainAnalysis', 'practicalTakeaways', 'closingInsight', 'cta'],
      },
    },
    finalize: (raw, input) => {
      // Phase 11D.3 — deterministic repair for an empty/blank practicalTakeaways. The
      // model (esp. Hebrew) occasionally completes (stop_reason=tool_use, NOT truncated)
      // yet returns an empty required array → Zod fail → corrective retry → mock-fallback
      // (degraded, ~90s wasted). Instead, backfill from the already-generated, language-
      // matched research material (keyInsights/importantClaims — NO extra Claude call);
      // last resort the model's own closingInsight. Recorded in metadata + a warn, never
      // silent. Genuine failures (everything blank) still fall through to the normal retry.
      let practicalTakeaways = strArr(raw.practicalTakeaways).map(s => s.trim()).filter(Boolean);
      let practicalTakeawaysRepaired = false;
      if (practicalTakeaways.length === 0) {
        const fromResearch = [...(input.research.keyInsights ?? []), ...(input.research.importantClaims ?? [])]
          .map(s => String(s).trim()).filter(Boolean);
        practicalTakeaways = fromResearch.slice(0, 3);
        if (practicalTakeaways.length === 0) {
          const ci = str(raw.closingInsight).trim();
          if (ci) practicalTakeaways = [ci];
        }
        practicalTakeawaysRepaired = practicalTakeaways.length > 0;
        if (practicalTakeawaysRepaired) {
          console.warn(`[contentGen:newsletter] empty practicalTakeaways (stop=tool_use) — deterministically repaired from research material (${practicalTakeaways.length} item(s)); no Claude retry.`);
        }
      }
      const breakdown = NewsletterBreakdownSchema.parse({
        subject: str(raw.subject), previewText: str(raw.previewText), opening: str(raw.opening),
        mainAnalysis: str(raw.mainAnalysis), practicalTakeaways,
        closingInsight: str(raw.closingInsight), cta: str(raw.cta),
      });
      const readyToPublish = [
        `Subject: ${breakdown.subject}`, `Preview: ${breakdown.previewText}`, '', SEP, '',
        breakdown.opening, '', breakdown.mainAnalysis, '',
        breakdown.practicalTakeaways.map(x => `- ${x}`).join('\n'), '',
        breakdown.closingInsight, '', breakdown.cta,
      ].join('\n').trim();
      const readingTimeMinutes = Math.max(1, Math.round(words(readyToPublish) / 200));
      return GeneratedOutputSchema.parse({
        platform: 'newsletter', title: breakdown.subject, readyToPublish, breakdown,
        metadata: baseMeta(input, { readingTimeMinutes, ...(practicalTakeawaysRepaired ? { practicalTakeawaysRepaired: true } : {}) }),
      });
    },
  },
};
