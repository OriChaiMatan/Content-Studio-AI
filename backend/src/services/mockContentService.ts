import {
  GeneratedOutputSchema,
  type GeneratedOutput,
  type GeneratorInput,
  type ImagePromptV2,
} from '../schemas/aiContractSchemas';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Content Service (Phase 9) — PERMANENT, v2-valid fallback
//
// Deterministically builds a v2 GeneratedOutput (readyToPublish + breakdown +
// metadata) for one platform from a GeneratorInput projection. Honors output
// language (en/he) and the product hashtag bounds (LI 0–3, FB 0–2, IG 5–8).
// Image prompts embedded only in LinkedIn / Facebook / Instagram.
//
// Used as the normal path while CONTENT_GENERATION_ENABLED=false (generatorVersion
// "mock-2", degraded=false) and as the fallback when a real Claude generator
// fails (caller re-stamps generatorVersion "mock-fallback", degraded=true).
// ─────────────────────────────────────────────────────────────────────────────

const SEP = '─────────────────────────────────';

// Language-keyed scaffolding labels.
const L = {
  en: {
    whatThisMeans: 'What this means:',
    keyPlayers: 'Key players:',
    takeaways: 'Key takeaways:',
    join: 'What\'s your take? Share your thoughts below.',
    cta: 'Follow for more analysis like this.',
    subject: (t: string) => `${t}: what\'s changing and why it matters`,
    openingHello: 'Hi there,',
    chapter: 'Chapter',
    episode: 'Deep Dive',
    fallbackHashtags: ['#content', '#insights', '#AI', '#business', '#strategy', '#technology'],
  },
  he: {
    whatThisMeans: 'מה זה אומר:',
    keyPlayers: 'גורמים מרכזיים:',
    takeaways: 'תובנות מרכזיות:',
    join: 'מה דעתכם? שתפו אותנו בתגובות.',
    cta: 'עקבו לעוד ניתוחים כאלה.',
    subject: (t: string) => `${t}: מה משתנה ולמה זה חשוב`,
    openingHello: 'שלום רב,',
    chapter: 'פרק',
    episode: 'צלילה לעומק',
    fallbackHashtags: ['#תוכן', '#תובנות', '#AI', '#עסקים', '#אסטרטגיה', '#טכנולוגיה'],
  },
} as const;

function tagify(s: string): string {
  const clean = s.trim().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  return clean.length > 0 ? '#' + clean : '';
}

// Build a hashtag list within [min,max], padding with language fallbacks.
function hashtags(input: GeneratorInput, min: number, max: number): string[] {
  const lang = input.contract.outputLanguage;
  const derived = [
    ...input.sources.keywords,
    ...input.sources.entities.map(e => e.name),
  ].map(tagify).filter(Boolean);
  const merged = [...new Set([...derived, ...L[lang].fallbackHashtags])].filter(h => h.length > 2);
  const out = merged.slice(0, max);
  // pad to min using fallbacks (already included, so this only matters if derived was tiny)
  let i = 0;
  while (out.length < min && i < L[lang].fallbackHashtags.length) {
    const t = L[lang].fallbackHashtags[i++];
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, max);
}

function img(role: 'primary' | 'alternative', title: string, topic: string, aspect: string, lang: 'en' | 'he'): ImagePromptV2 {
  return lang === 'he'
    ? {
        role,
        prompt: `תמונת עריכה המייצגת את ${title}. דגש על ${topic}. קומפוזיציה נקייה עם מטאפורה ויזואלית חזקה.`,
        aspectRatio: aspect,
        visualStyle: 'אסתטיקה מודרנית ונקייה, טיפוגרפיה ברורה',
        mood: 'מקצועי ומעורר השראה',
        negativePrompt: 'מטושטש, עמוס, טקסט על התמונה, איכות נמוכה, סימני מים',
      }
    : {
        role,
        prompt: `Editorial image representing ${title}. Focus on ${topic}. Clean composition with a strong visual metaphor.`,
        aspectRatio: aspect,
        visualStyle: 'Clean modern aesthetic, bold typography',
        mood: 'Professional and thought-provoking',
        negativePrompt: 'blurry, cluttered, text overlays, low quality, watermarks',
      };
}

// Primary material, preferring verified facts then research.
function material(input: GeneratorInput) {
  const topic = input.research.mainTopics[0] || input.brief.caseTitle;
  const hook = input.research.suggestedHooks[0] || `${topic}`;
  const insight = input.research.keyInsights[0] || input.research.summary;
  const angle = input.research.suggestedAngles[0] || insight;
  const claims = (input.facts.verified.length > 0
    ? input.facts.verified.map(c => c.claim)
    : input.research.importantClaims).slice(0, 4);
  const entities = input.sources.entities.map(e => e.name);
  return { topic, hook, insight, angle, claims, entities };
}

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Build a v2 mock output for one platform. Validated against the v2 schema. */
export function generateMockContent(input: GeneratorInput): GeneratedOutput {
  const lang = input.contract.outputLanguage;
  const t = L[lang];
  const { topic, hook, insight, angle, claims, entities } = material(input);
  const caseTitle = input.brief.caseTitle;
  const meta = (extra: Record<string, unknown> = {}) => ({
    generatorVersion: 'mock-2',
    degraded: false,
    // Phase 10D.0 — preserve upstream research degradation through the mock path too.
    researchDegraded:         input.contract.researchDegraded === true,
    researchGeneratorVersion: input.contract.researchGeneratorVersion,
    contentScore: 80,
    researchConfidence: input.research.confidenceScore,
    factCheckAccuracy: input.facts.overallConfidenceScore,
    ...extra,
  });

  switch (input.contract.platform) {
    case 'linkedin': {
      const tags = hashtags(input, 0, 3);
      const takeaways = (claims.length > 0 ? claims : input.research.keyInsights).slice(0, 5);
      const ip = img('primary', caseTitle, topic, '1.91:1', lang);
      const breakdown = {
        hook, context: input.research.summary, insight,
        takeaways: takeaways.length > 0 ? takeaways : [insight],
        cta: t.cta, hashtags: tags, imagePrompt: ip,
      };
      const readyToPublish = [
        hook, '', SEP, '', insight, '', angle, '', t.takeaways,
        breakdown.takeaways.map((x, i) => `${i + 1}. ${x}`).join('\n'),
        '', t.cta, ...(tags.length ? ['', tags.join(' ')] : []),
      ].join('\n').trim();
      return GeneratedOutputSchema.parse({ platform: 'linkedin', title: caseTitle, readyToPublish, breakdown, metadata: meta({ hashtags: tags, imagePrompts: [ip] }) });
    }

    case 'facebook': {
      const tags = hashtags(input, 0, 2);
      const ip = img('primary', caseTitle, topic, '1.91:1', lang);
      const cq = lang === 'he' ? `איך אתם רואים את ההשפעה של ${topic}?` : `How do you see ${topic} playing out?`;
      const breakdown = {
        hook, story: input.research.summary, personalInterpretation: angle,
        communityQuestion: cq, hashtags: tags, imagePrompt: ip,
      };
      const readyToPublish = [hook, '', input.research.summary, '', angle, '', cq, ...(tags.length ? ['', tags.join(' ')] : [])].join('\n').trim();
      return GeneratedOutputSchema.parse({ platform: 'facebook', title: `${caseTitle}`, readyToPublish, breakdown, metadata: meta({ hashtags: tags, imagePrompts: [ip] }) });
    }

    case 'instagram': {
      const tags = hashtags(input, 5, 8);
      const primary = img('primary', caseTitle, topic, '1:1', lang);
      const alternative = img('alternative', caseTitle, topic, '4:5', lang);
      const strong = (lang === 'he' ? `${topic} משנה הכול.` : `${topic} changes everything.`);
      const body = [insight, '', `${angle} 👇`].join('\n');
      const breakdown = {
        hook: strong.length > 120 ? strong.slice(0, 117) + '…' : strong,
        body, cta: t.cta, hashtags: tags,
        primaryImagePrompt: primary, alternativeImagePrompt: alternative,
      };
      const readyToPublish = [breakdown.hook, '', body, '', t.cta, '', tags.join(' ')].join('\n').trim();
      return GeneratedOutputSchema.parse({ platform: 'instagram', title: `${caseTitle}`, readyToPublish, breakdown, metadata: meta({ hashtags: tags, imagePrompts: [primary, alternative] }) });
    }

    case 'newsletter': {
      const subject = t.subject(caseTitle);
      const takeaways = (claims.length > 0 ? claims : input.research.keyInsights).slice(0, 6);
      const mainAnalysis = [input.research.summary, '', ...input.research.keyInsights.map(k => `• ${k}`)].join('\n');
      const opening = lang === 'he' ? `השבוע אנחנו מסקרים את ${caseTitle}.` : `This week we cover ${caseTitle}.`;
      const closing = angle;
      const breakdown = {
        subject, previewText: insight.slice(0, 140), opening, mainAnalysis,
        practicalTakeaways: takeaways.length > 0 ? takeaways : [insight],
        closingInsight: closing, cta: t.cta,
      };
      const body = [
        `Subject: ${subject}`, `Preview: ${breakdown.previewText}`, '', SEP, '',
        t.openingHello, '', opening, '', mainAnalysis, '', t.takeaways,
        breakdown.practicalTakeaways.map(x => `- ${x}`).join('\n'), '', closing, '', t.cta,
      ].join('\n');
      const readingTimeMinutes = Math.max(1, Math.round(words(body) / 200));
      return GeneratedOutputSchema.parse({ platform: 'newsletter', title: subject, readyToPublish: body.trim(), breakdown, metadata: meta({ readingTimeMinutes }) });
    }

    case 'podcast': {
      const title = `${caseTitle} — ${t.episode}`;
      const chapters = input.research.mainTopics.slice(0, 6).map((m, i) => ({ title: `${t.chapter} ${i + 1}: ${m}`, summary: m }));
      const safeChapters = chapters.length > 0 ? chapters : [{ title: `${t.chapter} 1`, summary: topic }];
      const actions = (claims.length > 0 ? claims : input.research.suggestedAngles).slice(0, 5);
      const fullScript = [
        `[INTRO] ${hook}`, insight, '',
        `[BACKGROUND] ${input.research.summary}`, '',
        `[WHAT HAPPENED] ${claims.join(' ')}`, '',
        `[WHY IT MATTERS] ${angle}`, '',
        `[BIGGER PICTURE] ${input.research.keyInsights.join(' ')}`, '',
        `[CLOSING] ${t.cta}`,
      ].join('\n');
      const breakdown = {
        title, description: input.research.summary,
        chapters: safeChapters,
        openingHook: hook, background: input.research.summary,
        whatHappened: claims.join(' ') || input.research.summary,
        whyItMatters: angle, biggerPicture: input.research.keyInsights.join(' ') || insight,
        whatMostPeopleMiss: input.research.risks.join(' ') || angle,
        practicalActions: actions.length > 0 ? actions : [angle],
        closingThoughts: insight, cta: t.cta, fullScript,
      };
      const estimatedWordCount = words(fullScript);
      const estimatedDurationMinutes = Math.max(1, Math.round(estimatedWordCount / 150));
      const readyToPublish = [`🎙️ ${title}`, '', SEP, '', fullScript].join('\n').trim();
      return GeneratedOutputSchema.parse({ platform: 'podcast', title, readyToPublish, breakdown, metadata: meta({ estimatedWordCount, estimatedDurationMinutes }) });
    }
  }
}
