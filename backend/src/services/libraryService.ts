import { prisma } from '../lib/prisma';

// ── Library serializer ─────────────────────────────────────────────────────────

function serializeItem(item: {
  id: string;
  contentCaseId: string;
  outputId: string;
  pipelineRunId: string | null;
  platform: string;
  title: string;
  body: string;
  status: string;
  version: string;
  date: Date;
  contentCase: { title: string };
}) {
  return {
    id:           item.id,
    contentCaseId:  item.contentCaseId,
    contentCaseName: item.contentCase.title,
    outputId:     item.outputId,
    pipelineRunId: item.pipelineRunId,
    platform:     item.platform,
    title:        item.title,
    body:         item.body,
    status:       item.status,
    version:      item.version,
    date:         item.date.toISOString(),
  };
}

// ── Service methods ────────────────────────────────────────────────────────────

export const libraryService = {

  // GET /api/library
  // Returns all approved library items grouped by Pipeline Run.
  // Each group shows: runId, case info, run date, approved count, platforms, source count, items[].
  //
  // Groups are sorted newest-run-first.
  // Items without a pipelineRunId are each their own singleton group (legacy data).
  async getGrouped(userId: string) {
    // 1. Fetch approved items — Phase 12: STRICT ownership, only items whose owning
    //    case belongs to the authenticated user.
    const items = await prisma.libraryItem.findMany({
      where:   { status: 'approved', contentCase: { userId } },
      include: { contentCase: { select: { title: true } } },
      orderBy: { date: 'desc' },
    });

    if (items.length === 0) return { runs: [] };

    // 2. Batch-fetch the runs we need
    const runIds = [...new Set(items.map(i => i.pipelineRunId).filter((id): id is string => id !== null))];
    const runs   = await prisma.pipelineRun.findMany({
      where:  { id: { in: runIds } },
      select: { id: true, startedAt: true, sourceCount: true, contentCaseId: true },
    });
    const runMap = new Map(runs.map(r => [r.id, r]));

    // 3. Group items by pipelineRunId
    //    Items without a run get their own singleton group keyed by outputId
    const groupMap = new Map<string, {
      runId:         string | null;
      caseId:        string;
      caseTitle:     string;
      runDate:       string;
      sourceCount:   number;
      items:         ReturnType<typeof serializeItem>[];
    }>();

    for (const item of items) {
      const groupKey = item.pipelineRunId ?? `solo-${item.outputId}`;

      if (!groupMap.has(groupKey)) {
        const run = item.pipelineRunId ? runMap.get(item.pipelineRunId) : null;
        groupMap.set(groupKey, {
          runId:       item.pipelineRunId,
          caseId:      item.contentCaseId,
          caseTitle:   item.contentCase.title,
          runDate:     run ? run.startedAt.toISOString() : item.date.toISOString(),
          sourceCount: run ? run.sourceCount : 0,
          items:       [],
        });
      }

      groupMap.get(groupKey)!.items.push(serializeItem(item));
    }

    // 4. Shape the final response
    const runGroups = Array.from(groupMap.values()).map(group => ({
      runId:        group.runId,
      caseId:       group.caseId,
      caseTitle:    group.caseTitle,
      runDate:      group.runDate,
      approvedCount: group.items.length,
      platforms:    [...new Set(group.items.map(i => i.platform))],
      sourceCount:  group.sourceCount,
      items:        group.items,
    }));

    // Sort newest run first
    runGroups.sort((a, b) => b.runDate.localeCompare(a.runDate));

    return { runs: runGroups };
  },
};
