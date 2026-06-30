import { Prisma } from '@prisma/client';
import type { VisualAsset, VisualStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { effectiveProvider } from '../../lib/visualConfig';
import { visualStorage } from '../../lib/visualStorage';
import { buildVisualBrief, overlayFromHeadline, type OverlaySpec } from './visualBrief';
import { analyzeVisual, humansAllowed, LIGHTING_MODES, type LightingMode } from './visualIntelligence';
import { buildBackgroundPrompt } from './visualPrompt';
import { getBackground, ProviderError } from './backgroundProvider';
import { renderOverlay } from './overlayRender';

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

// Reuse payload for regenerate (reroll the image, keep the concept + headline + lighting).
interface ReusePlan { scene: string; overlay?: OverlaySpec; palette?: string; archetype?: string; lighting?: string }

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

    // Visual Intelligence: thesis → archetype + concrete scene + palette + compressed
    // headline. On regenerate, reuse the prior plan (reroll image, keep the idea).
    // mock/offline path stays deterministic (no LLM).
    let scene: string;
    let overlay: OverlaySpec = brief.overlay;
    let palette: string | undefined;
    let archetype: string | undefined;
    let lighting: LightingMode = 'bright_editorial'; // Sprint 4.5 — bright editorial is the default

    if (opts.reuse?.scene) {
      scene = opts.reuse.scene;
      overlay = opts.reuse.overlay ?? brief.overlay;
      palette = opts.reuse.palette;
      archetype = opts.reuse.archetype;
      if (opts.reuse.lighting && LIGHTING_MODES.includes(opts.reuse.lighting as LightingMode)) lighting = opts.reuse.lighting as LightingMode;
    } else if (provider === 'openai') {
      const plan = await analyzeVisual(brief.fields, brief.visualCategory);
      scene = plan.scene; palette = plan.palette; archetype = plan.archetype; lighting = plan.lighting;
      overlay = overlayFromHeadline(plan.headline, plan.accent); // compressed headline → overlay (white by default)
    } else {
      scene = (brief.fields.thesis || brief.fields.title || 'A bright, clean editorial scene.').replace(/\.?$/, '.');
    }

    // Humans forbidden by default; allowed only for human-dynamics theses.
    const allowHumans = humansAllowed(brief.visualCategory, `${brief.fields.thesis ?? ''} ${brief.fields.hook ?? ''} ${brief.fields.title ?? ''}`);
    // Tell the model which side to keep clear so white text reads with no overlay.
    const textSide: 'left' | 'right' = overlay.dir === 'rtl' ? 'right' : 'left';
    const prompt = buildBackgroundPrompt(scene, archetype, lighting, allowHumans, textSide);
    await setStatus(assetId, {
      visualCategory: brief.visualCategory, visualIntent: scene, backgroundPrompt: prompt,
      // palette/archetype/lighting exposed via the existing Json column (no schema change).
      overlaySpec: { ...overlay, ...(palette ? { palette } : {}), ...(archetype ? { archetype } : {}), lighting } as unknown as Prisma.InputJsonValue,
      provider, model: provider === 'openai' ? 'gpt-image-1' : 'mock',
    });

    const bg = await getBackground(provider, prompt);
    const bgKey = `${assetId}/bg.png`;
    await visualStorage.put(bgKey, bg);
    await setStatus(assetId, { status: 'rendering', backgroundKey: bgKey });

    const { png, width, height } = await renderOverlay(bg, overlay, asset.platform);
    const finalKey = `${assetId}/final.png`;
    await visualStorage.put(finalKey, png);
    await setStatus(assetId, { status: 'ready', finalKey, width, height });
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
    const latest = await prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
    const asset = await prisma.visualAsset.create({
      data: { contentOutputId, contentCaseId, platform, language: latest?.language ?? 'en', status: 'pending', version: (latest?.version ?? 0) + 1 },
    });
    const spec = (latest?.overlaySpec ?? null) as (OverlaySpec & { palette?: string; archetype?: string; lighting?: string }) | null;
    const reuse = latest?.visualIntent
      ? { reuse: { scene: latest.visualIntent, overlay: spec ?? undefined, palette: spec?.palette, archetype: spec?.archetype, lighting: spec?.lighting } }
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
