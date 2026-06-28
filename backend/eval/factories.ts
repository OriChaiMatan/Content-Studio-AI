import type { ContentCase, ContentSource, PipelineRun } from '@prisma/client';
import type { FixtureSource } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory Prisma-shaped factories (Phase 3A)
//
// The generation services (researchSynthesisService, generateFactCheckReport,
// buildGeneratorInput, contentGeneratorService) take plain ContentCase / Content-
// Source / PipelineRun objects and never touch the DB. These factories fabricate
// fully-typed instances so the harness can drive the REAL path with zero DB writes.
// ─────────────────────────────────────────────────────────────────────────────

export function makeCase(over: Partial<ContentCase> = {}): ContentCase {
  const now = new Date();
  return {
    id:                  'eval-case',
    userId:              'eval-user',
    title:               'Eval Case',
    status:              'draft',
    language:            'en',
    targetAudience:      '',
    industry:            '',
    experienceLevel:     'intermediate',
    writingStyle:        '',
    goals:               '',
    aiInstructions:      '',
    scheduleFrequency:   'manual',
    scheduleTime:        null,
    scheduleDayOfWeek:   null,
    scheduleDayOfMonth:  null,
    lastScheduledSlotKey: null,
    contentGoal:         'build_authority',
    goalCustom:          null,
    contentStyle:        'professional',
    styleCustom:         null,
    contentTargets:      ['facebook'],
    createdAt:           now,
    updatedAt:           now,
    ...over,
  };
}

export function makeSource(caseId: string, src: FixtureSource, index: number): ContentSource {
  const now = new Date();
  return {
    id:                `eval-source-${index}`,
    contentCaseId:     caseId,
    type:              src.type,
    label:             src.label,
    content:           src.content,
    filePath:          null,
    fileSize:          null,
    mimeType:          null,
    status:            'new',
    usedInRunId:       null,
    lastUsedAt:        null,
    sourceIntelligence: src.sourceIntelligence as ContentSource['sourceIntelligence'],
    extractedTitle:    null,
    extractedText:     null,
    extractionStatus:  null,
    extractionError:   null,
    extractedAt:       null,
    createdAt:         now,
    updatedAt:         null,
  };
}

export function makeRun(caseId: string, primarySourceIds: string[], outputLanguage: string): PipelineRun {
  const now = new Date();
  return {
    id:               'eval-run',
    contentCaseId:    caseId,
    triggeredBy:      'eval',
    outputLanguage,
    status:           'running',
    primarySourceIds,
    contextSourceIds: [],
    sourceCount:      primarySourceIds.length,
    startedAt:        now,
    completedAt:      null,
    errorMessage:     null,
    researchContext:  null,
    factCheckReport:  null,
    contentPackage:   null,
  };
}
