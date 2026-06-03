import type { ContentCase } from '@prisma/client';
import type { ContentPackage } from '../schemas/aiContractSchemas';

type Platform = 'linkedin' | 'facebook' | 'instagram' | 'newsletter' | 'podcast' | 'image_prompt';

interface OutputData {
  title: string;
  body: string;
  contentScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Package Mapper
//
// Transforms a validated ContentPackage into the 6 ContentOutput body strings
// that the Review/Library/Approval system already knows how to handle.
//
// All outputs use whitespace-friendly plain text so the Review card's
// `whitespace-pre-wrap` rendering makes them immediately readable.
// ─────────────────────────────────────────────────────────────────────────────

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const LINE_SHORT = '─────────────────────────────────';

export function packageToOutputs(
  pkg: ContentPackage,
  caseItem: ContentCase,
): Record<Platform, OutputData> {
  return {
    linkedin:     mapLinkedIn(pkg, caseItem),
    facebook:     mapFacebook(pkg, caseItem),
    instagram:    mapInstagram(pkg, caseItem),
    newsletter:   mapNewsletter(pkg, caseItem),
    podcast:      mapPodcast(pkg, caseItem),
    image_prompt: mapImagePrompts(pkg, caseItem),
  };
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────

function mapLinkedIn(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { hook, body, hashtags } = pkg.linkedin;
  return {
    title: pkg.linkedin.title,
    body: [
      hook,
      '',
      LINE_SHORT,
      '',
      body,
      '',
      LINE_SHORT,
      '',
      hashtags.join(' '),
    ].join('\n'),
    contentScore: 88,
  };
}

// ── Facebook ──────────────────────────────────────────────────────────────────

function mapFacebook(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { body, callToAction, imagePromptRef } = pkg.facebook;
  return {
    title: pkg.facebook.title,
    body: [
      body,
      '',
      LINE_SHORT,
      '',
      `📌 ${callToAction}`,
      '',
      `[Image: ${imagePromptRef} — see Image Prompts output for full visual direction]`,
    ].join('\n'),
    contentScore: 85,
  };
}

// ── Instagram ─────────────────────────────────────────────────────────────────

function mapInstagram(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { strongLine, caption, imagePromptRef } = pkg.instagram;
  return {
    title: `${caseItem.title} — Instagram`,
    body: [
      `✨ ${strongLine}`,
      '',
      LINE_SHORT,
      '',
      caption,
      '',
      `[Image: ${imagePromptRef} — see Image Prompts output for full visual direction]`,
    ].join('\n'),
    contentScore: 83,
  };
}

// ── Newsletter ────────────────────────────────────────────────────────────────

function mapNewsletter(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { subject, previewText, body, callToAction } = pkg.newsletter;
  return {
    title: subject,
    body: [
      `Subject: ${subject}`,
      `Preview: ${previewText}`,
      '',
      LINE,
      '',
      body,
      '',
      LINE,
      '',
      `→ ${callToAction}`,
    ].join('\n'),
    contentScore: 90,
  };
}

// ── Podcast ───────────────────────────────────────────────────────────────────

function mapPodcast(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { title, intro, segments, closing, fullScript } = pkg.podcast;
  const segmentBlocks = segments.map(s => [
    `[${s.title.toUpperCase()}]`,
    LINE_SHORT,
    s.content,
  ].join('\n')).join('\n\n');

  return {
    title: title,
    body: [
      `🎙️  ${title}`,
      LINE,
      '',
      '[INTRO]',
      LINE_SHORT,
      intro,
      '',
      segmentBlocks,
      '',
      '[CLOSING]',
      LINE_SHORT,
      closing,
      '',
      LINE,
      '',
      '[ FULL SCRIPT ]',
      LINE_SHORT,
      fullScript,
    ].join('\n'),
    contentScore: 87,
  };
}

// ── Image Prompts ─────────────────────────────────────────────────────────────
// Both image prompts are stored in a single image_prompt ContentOutput.
// Clearly separated with labels, aspect ratios, and all prompt fields.

function mapImagePrompts(pkg: ContentPackage, caseItem: ContentCase): OutputData {
  const { instagramImage, facebookLinkedinImage } = pkg.images;

  return {
    title: `${caseItem.title} — Image Prompts`,
    body: [
      `INSTAGRAM IMAGE PROMPT  (${instagramImage.aspectRatio} — Square)`,
      LINE,
      `Prompt:         ${instagramImage.prompt}`,
      `Visual Style:   ${instagramImage.visualStyle}`,
      `Mood:           ${instagramImage.mood}`,
      `Negative:       ${instagramImage.negativePrompt}`,
      '',
      '',
      `FACEBOOK / LINKEDIN IMAGE PROMPT  (${facebookLinkedinImage.aspectRatio} — Landscape)`,
      LINE,
      `Prompt:         ${facebookLinkedinImage.prompt}`,
      `Visual Style:   ${facebookLinkedinImage.visualStyle}`,
      `Mood:           ${facebookLinkedinImage.mood}`,
      `Negative:       ${facebookLinkedinImage.negativePrompt}`,
      '',
      '[ These prompts are ready for use with any text-to-image AI service ]',
    ].join('\n'),
    contentScore: 82,
  };
}
