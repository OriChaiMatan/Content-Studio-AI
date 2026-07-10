import { Prisma } from '@prisma/client';
import type { VisualAsset, VisualStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { effectiveProvider } from '../../lib/visualConfig';
import { visualStorage } from '../../lib/visualStorage';
import { buildOverlay, type LabelChip, type OverlaySpec } from './visualBrief';
import { buildVisualBrief } from './visualBrief';
import { analyzeVisual, deterministicPlan, REFRAME_NOTE, type VisualPlan } from './visualIntelligence';
import { buildImagePrompt, visualDebug } from './visualPrompt';
import { critiqueRenders } from './renderCritic';
import { DESIGN_VERSION } from './lumaiDesign';
import { getBackground, ProviderError } from './backgroundProvider';
import { renderOverlay } from './overlayRender';
import { quotaConfig } from '../../lib/quotaConfig';
import { checkAndIncrementUsage } from '../usageService';

const ACTIVE: ReadonlyArray<string> = ['pending', 'generating', 'rendering'];

// Client-facing projection. finalUrl is the ownership-checked image route.
export function serializeVisualAsset(a: VisualAsset) {
  const ready = a.status === 'ready' && !!a.finalKey;
  return {
    id: a.id,
    status: a.status,
    platform: a.platform,
    version: a.version,
    degraded: a.status === 'failed',
    errorCode: a.errorCode,
    errorMessage: a.errorMessage,
    finalUrl: ready
      ? `/api/cases/${a.contentCaseId}/outputs/${a.contentOutputId}/visual/${a.id}/image`
      : null,
    updatedAt: a.updatedAt,
  };
}

// Only the mutable scalar fields — avoids Prisma rejecting id/relation fields.
type VisualPatch = {
  status?: VisualStatus;
  visualCategory?: string | null;
  visualIntent?: string | null;
  backgroundPrompt?: string | null;
  overlaySpec?: Prisma.InputJsonValue;
  provider?: string | null;
  model?: string | null;
  backgroundKey?: string | null;
  finalKey?: string | null;
  width?: number | null;
  height?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};
async function setStatus(id: string, data: VisualPatch) {
  await prisma.visualAsset.update({ where: { id }, data });
}

// Reuse payload for regenerate (reroll the image, keep the WHOLE visual plan + overlay
// so no second Visual-Intelligence LLM call is spent).
interface ReusePlan { plan: VisualPlan; overlay?: OverlaySpec }

// Sprint 10 — best-of-N: image generation is stochastic, so draw several and let the
// Render Critic pick. 3 by default (clamped 1–4).
const BEST_OF = Math.max(1, Math.min(4, parseInt(process.env.IMAGE_BEST_OF ?? '3', 10) || 3));

// Generate N backgrounds (in parallel) and composite each into a final PNG. Tolerant of a
// few failed draws — needs only one to succeed.
async function generateAndComposite(prompt: string, overlay: OverlaySpec, platform: string): Promise<{
  bgs: Buffer[]; finals: Array<{ png: Buffer; width: number; height: number }>;
}> {
  const settled = await Promise.allSettled(Array.from({ length: BEST_OF }, () => getBackground('openai', prompt)));
  const bgs = settled.filter((s): s is PromiseFulfilledResult<Buffer> => s.status === 'fulfilled').map(s => s.value);
  if (bgs.length === 0) throw (settled.find(s => s.status === 'rejected') as PromiseRejectedResult).reason;
  const finals: Array<{ png: Buffer; width: number; height: number }> = [];
  for (const bg of bgs) finals.push(await renderOverlay(bg, overlay, platform)); // sequential — one browser
  return { bgs, finals };
}

// The detached worker. NEVER throws — every failure becomes a clean `failed` row.
async function generate(assetId: string, opts: { reuse?: ReusePlan } = {}): Promise<void> {
  try {
    const asset = await prisma.visualAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    const output = await prisma.contentOutput.findUnique({ where: { id: asset.contentOutputId } });
    const caseItem = output ? await prisma.contentCase.findUnique({ where: { id: output.contentCaseId } }) : null;
    if (!output || !caseItem) { await setStatus(assetId, { status: 'failed', errorCode: 'not_found', errorMessage: 'Output not found.' }); return; }

    const provider = effectiveProvider();
    if (provider === 'disabled') {
      await setStatus(assetId, { status: 'failed', errorCode: 'disabled', errorMessage: 'Visual generation is currently unavailable.' });
      return;
    }

    await setStatus(assetId, { status: 'generating' });
    const brief = buildVisualBrief(output, caseItem);

    // LEAN planner: one Claude pass → the strongest inevitable concept + English copy.
    // On regenerate, reuse the stored plan (reroll the image, keep the idea). mock/offline
    // stays deterministic (no LLM).
    let plan: VisualPlan;
    if (opts.reuse) {
      plan = opts.reuse.plan;
    } else if (provider === 'openai') {
      plan = await analyzeVisual(brief.fields, brief.visualCategory);
    } else {
      plan = deterministicPlan(brief.fields, brief.visualCategory, 'mock');
    }

    // Build the two-tier overlay from a plan. Layout (not RTL) drives the text-zone side;
    // labels come from any visual group that carries one (default: none).
    const overlayFor = (pl: VisualPlan): OverlaySpec => {
      if (opts.reuse?.overlay) return opts.reuse.overlay;
      const labels: LabelChip[] = pl.visualGroups.filter(g => g.label).map(g => ({ text: g.label as string, anchor: g.anchor, position: g.labelPosition }));
      return buildOverlay(pl.headline, pl.supportingLine, pl.layout, labels);
    };
    const storePlan = (pl: VisualPlan, ov: OverlaySpec, pr: string) => setStatus(assetId, {
      visualCategory: brief.visualCategory, visualIntent: pl.scene, backgroundPrompt: pr,
      overlaySpec: { ...ov, plan: pl, designVersion: DESIGN_VERSION } as unknown as Prisma.InputJsonValue,
      provider, model: provider === 'openai' ? 'gpt-image-1' : 'mock',
    });

    let overlay = overlayFor(plan);
    let prompt = buildImagePrompt(plan);
    await storePlan(plan, overlay, prompt);
    if (process.env.VISUAL_DEBUG === '1') console.debug('[visual] plan+prompt', JSON.stringify(visualDebug(plan, prompt)));

    let bg: Buffer;
    let final: { png: Buffer; width: number; height: number };

    if (provider === 'openai') {
      // Best-of-N generation → Render Critic judges the ACTUAL pixels → pick the winner.
      // If the critic REJECTS ALL as "correct but boring", reframe ONCE and regenerate.
      let sel = await generateAndComposite(prompt, overlay, asset.platform);
      let critique = await critiqueRenders(sel.finals.map(f => f.png), plan);
      if (critique.rejectAll && !opts.reuse) {
        plan = await analyzeVisual(brief.fields, brief.visualCategory, { reframeNote: REFRAME_NOTE });
        overlay = overlayFor(plan); prompt = buildImagePrompt(plan);
        await storePlan(plan, overlay, prompt);
        sel = await generateAndComposite(prompt, overlay, asset.platform);
        critique = await critiqueRenders(sel.finals.map(f => f.png), plan);
      }
      const idx = critique.winnerIndex ?? 0;
      bg = sel.bgs[idx]; final = sel.finals[idx];
      if (process.env.VISUAL_DEBUG === '1') console.debug('[visual] critic', JSON.stringify({ n: sel.finals.length, idx, rejectAll: critique.rejectAll, source: critique.source }));
    } else {
      bg = await getBackground(provider, prompt);
      final = await renderOverlay(bg, overlay, asset.platform);
    }

    const bgKey = `${assetId}/bg.png`;
    await visualStorage.put(bgKey, bg);
    await setStatus(assetId, { status: 'rendering', backgroundKey: bgKey });
    const finalKey = `${assetId}/final.png`;
    await visualStorage.put(finalKey, final.png);
    await setStatus(assetId, { status: 'ready', finalKey, width: final.width, height: final.height });
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : 'render_error';
    const message = err instanceof Error ? err.message : 'Visual generation failed.';
    console.error(`[visualAssetService] generate ${assetId} failed:`, message);
    try { await setStatus(assetId, { status: 'failed', errorCode: code, errorMessage: message }); } catch { /* swallow */ }
  }
}

async function nextVersion(contentOutputId: string, platform: VisualAsset['platform']): Promise<number> {
  const latest = await prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
  return (latest?.version ?? 0) + 1;
}

export const visualAssetService = {
  serializeVisualAsset,

  // Start (or return the already-running) generation for an output+platform.
  async start(contentCaseId: string, contentOutputId: string, platform: VisualAsset['platform']): Promise<VisualAsset> {
    const active = await prisma.visualAsset.findFirst({
      where: { contentOutputId, platform, status: { in: ACTIVE as VisualAsset['status'][] } },
      orderBy: { version: 'desc' },
    });
    if (active) return active; // idempotent — don't double-spend on a quick double-click

    if (quotaConfig.enforceQuotas) {
      const { userId } = await prisma.contentCase.findUniqueOrThrow({ where: { id: contentCaseId }, select: { userId: true } });
      await checkAndIncrementUsage(userId, 'IMAGE_GENERATION');
    }

    const output = await prisma.contentOutput.findUnique({ where: { id: contentOutputId } });
    const caseItem = output ? await prisma.contentCase.findUnique({ where: { id: output.contentCaseId } }) : null;
    const language = caseItem?.language === 'he' ? 'he' : 'en';

    const asset = await prisma.visualAsset.create({
      data: { contentOutputId, contentCaseId, platform, language, status: 'pending', version: await nextVersion(contentOutputId, platform) },
    });
    void generate(asset.id);
    return asset;
  },

  // New version, reusing the prior plan (scene + headline + palette) so a reroll varies
  // the IMAGE, not the idea — and avoids a second Visual-Intelligence LLM call.
  async regenerate(contentCaseId: string, contentOutputId: string, platform: VisualAsset['platform']): Promise<VisualAsset> {
    if (quotaConfig.enforceQuotas) {
      const { userId } = await prisma.contentCase.findUniqueOrThrow({ where: { id: contentCaseId }, select: { userId: true } });
      await checkAndIncrementUsage(userId, 'IMAGE_GENERATION');
    }

    const latest = await prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
    const asset = await prisma.visualAsset.create({
      data: { contentOutputId, contentCaseId, platform, language: latest?.language ?? 'en', status: 'pending', version: (latest?.version ?? 0) + 1 },
    });
    const spec = (latest?.overlaySpec ?? null) as (OverlaySpec & { plan?: VisualPlan }) | null;
    // Reuse only when a stored plan exists (new assets). Legacy rows without one fall
    // through to a fresh plan (one extra LLM call) rather than break the reroll.
    const reuse = spec?.plan
      ? { reuse: { plan: spec.plan, overlay: { lines: spec.lines, body: spec.body, dir: spec.dir, layout: spec.layout, labels: spec.labels ?? [] } } }
      : {};
    void generate(asset.id, reuse);
    return asset;
  },

  async getLatest(contentOutputId: string, platform: VisualAsset['platform']): Promise<VisualAsset | null> {
    return prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
  },

  async getById(id: string): Promise<VisualAsset | null> {
    return prisma.visualAsset.findUnique({ where: { id } });
  },
};
