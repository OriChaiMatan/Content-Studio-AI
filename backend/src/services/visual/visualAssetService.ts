import { Prisma } from '@prisma/client';
import type { VisualAsset, VisualStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { effectiveProvider } from '../../lib/visualConfig';
import { visualStorage } from '../../lib/visualStorage';
import { buildVisualBrief } from './visualBrief';
import { extractVisualIntent } from './visualIntent';
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

// The detached worker. NEVER throws — every failure becomes a clean `failed` row.
async function generate(assetId: string, opts: { reuseIntent?: string | null } = {}): Promise<void> {
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

    // Intent: real provider distills via Claude; reuse on regenerate; mock uses thesis.
    let intent = opts.reuseIntent ?? '';
    if (!intent) {
      if (provider === 'openai') intent = (await extractVisualIntent(brief.fields)).intent;
      else intent = (brief.fields.thesis || brief.fields.title || 'A vast cinematic system.').replace(/\.?$/, '.');
    }
    const prompt = buildBackgroundPrompt(intent);
    await setStatus(assetId, {
      visualCategory: brief.visualCategory, visualIntent: intent, backgroundPrompt: prompt,
      overlaySpec: brief.overlay as unknown as Prisma.InputJsonValue, provider, model: provider === 'openai' ? 'gpt-image-1' : 'mock',
    });

    const bg = await getBackground(provider, prompt);
    const bgKey = `${assetId}/bg.png`;
    await visualStorage.put(bgKey, bg);
    await setStatus(assetId, { status: 'rendering', backgroundKey: bgKey });

    const { png, width, height } = await renderOverlay(bg, brief.overlay, asset.platform);
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

  // New version, reusing the prior concept so a reroll varies the IMAGE, not the idea.
  async regenerate(contentCaseId: string, contentOutputId: string, platform: VisualAsset['platform']): Promise<VisualAsset> {
    const latest = await prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
    const asset = await prisma.visualAsset.create({
      data: { contentOutputId, contentCaseId, platform, language: latest?.language ?? 'en', status: 'pending', version: (latest?.version ?? 0) + 1 },
    });
    void generate(asset.id, { reuseIntent: latest?.visualIntent ?? null });
    return asset;
  },

  async getLatest(contentOutputId: string, platform: VisualAsset['platform']): Promise<VisualAsset | null> {
    return prisma.visualAsset.findFirst({ where: { contentOutputId, platform }, orderBy: { version: 'desc' } });
  },

  async getById(id: string): Promise<VisualAsset | null> {
    return prisma.visualAsset.findUnique({ where: { id } });
  },
};
