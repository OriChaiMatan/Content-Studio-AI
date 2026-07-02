import { getAnthropicClient, sourceAnalysisConfig } from '../../lib/anthropic';
import type { VisualPlan } from './visualIntelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Render Critic (Sprint 10) — the taste layer. A ruthless world-class Art Director
// (Claude Vision) that judges the ACTUAL rendered PNGs, not the plan. It picks the
// strongest candidate or returns REJECT_ALL (→ the planner reframes once). This is
// where "correct but boring" is caught — text heuristics never could.
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateScore {
  index: number;
  thesisClarity: number; // instantly communicates the thesis (0–10)
  tension: number;       // real visual tension / asymmetry (0–10)
  memorable: number;     // memorable vs generic (0–10)
  premium: number;       // a world-class designer would publish it (0–10)
  verdict: 'approve' | 'reject';
  reason: string;
}
export interface Critique {
  scores: CandidateScore[];
  winnerIndex: number | null; // null ⇒ REJECT_ALL
  rejectAll: boolean;
  reason: string;
  source: 'critic' | 'no-client' | 'error' | 'parse';
}

const SYSTEM = `You are a ruthless, world-class Creative Director judging FINAL rendered images for LumAI (Apple / Stripe / OpenAI editorial). You are NOT a logic evaluator — you have TASTE.

PRODUCTION RULE: approve ONLY images that are CLEARLY PUBLISHABLE. There is NO "approved with reservations". If an image is somewhat generic, a stock-photo metaphor, visually safe, correct-but-not-memorable, low stop-scroll, or has weak tension → REJECT it. When in doubt, REJECT.

REJECT any image that is: merely correct, safe, generic, visually boring, too literal, or pretty-but-forgettable. Heavily penalize "correct but boring" — a technically accurate image with no tension is a FAILURE.

APPROVE only images that feel: premium, inevitable, impossible to ignore, strong enough that a top studio would publish them without hesitation. Scores of 7+ across clarity, tension, memorability AND premium are required to approve — anything less is a reject.

For EACH candidate answer:
1. Does it communicate the thesis instantly?
2. Is there real visual tension / asymmetry?
3. Is it memorable or generic?
4. Would a world-class designer proudly publish it?

Examples of the judgment we want:
- A 2%-full glass for "fintech returns" → REJECT (correct but boring).
- A glass that looks 80% full but has a false bottom revealing 2% real value → APPROVE (illusion vs reality).
- A battery at 1% for burnout → REJECT (symptom, not mechanism).
- A treadmill/conveyor where every gain triggers more work → APPROVE (mechanism).

Then choose the SINGLE strongest candidate as winnerIndex, OR set rejectAll=true if ALL candidates are merely correct/boring/generic/forgettable. Do not settle.

Return ONLY JSON (no prose, no code fences):
{"scores":[{"index":number,"thesisClarity":number,"tension":number,"memorable":number,"premium":number,"verdict":"approve"|"reject","reason":string}],"winnerIndex":number|null,"rejectAll":boolean,"reason":string}`;

function parseJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>; } catch { return null; }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
}
// Production floor — a candidate is a valid winner ONLY if it is clearly publishable:
// approved AND ≥ 7 on every dimension. Enforced in code so a lenient model can't sneak an
// "approved with reservations" image through.
const PUBLISH_FLOOR = 7;
function isPublishable(s: CandidateScore): boolean {
  return s.verdict === 'approve'
    && s.thesisClarity >= PUBLISH_FLOOR && s.tension >= PUBLISH_FLOOR
    && s.memorable >= PUBLISH_FLOOR && s.premium >= PUBLISH_FLOOR;
}
// Highest total among the given candidates.
function bestByScore(scores: CandidateScore[]): number {
  let best = scores[0]?.index ?? 0, bestVal = -Infinity;
  for (const s of scores) {
    const v = s.premium + s.tension + s.thesisClarity + s.memorable;
    if (v > bestVal) { bestVal = v; best = s.index; }
  }
  return best;
}

// Judge N composited PNGs. Never throws — on any failure it ships candidate 0.
export async function critiqueRenders(pngs: Buffer[], plan: VisualPlan): Promise<Critique> {
  const n = pngs.length;
  if (n === 0) return { scores: [], winnerIndex: null, rejectAll: true, reason: 'no candidates', source: 'error' };
  if (n === 1) return { scores: [], winnerIndex: 0, rejectAll: false, reason: 'single candidate', source: 'critic' };

  const client = getAnthropicClient();
  if (!client) return { scores: [], winnerIndex: 0, rejectAll: false, reason: 'no vision client', source: 'no-client' };

  const intro = `THESIS: ${plan.thesis}\nMECHANISM: ${plan.mechanism}\nHEADLINE: ${plan.headline}\n\nHere are ${n} candidate images (0..${n - 1}) for the SAME post. Judge the pixels. Pick the strongest, or REJECT_ALL if every one is merely correct/boring.`;
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: intro }];
  pngs.forEach((png, i) => {
    content.push({ type: 'text', text: `Candidate ${i}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } });
  });

  try {
    const msg = await client.messages.create({
      model: sourceAnalysisConfig.model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: content as never }],
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ');
    const json = parseJson(text);
    if (!json) return { scores: [], winnerIndex: 0, rejectAll: false, reason: 'unparseable critique', source: 'parse' };

    const scores: CandidateScore[] = Array.isArray(json.scores)
      ? (json.scores as Array<Record<string, unknown>>).map((s, i): CandidateScore => ({
          index: Number.isInteger(s.index) ? Number(s.index) : i,
          thesisClarity: num(s.thesisClarity), tension: num(s.tension), memorable: num(s.memorable), premium: num(s.premium),
          verdict: s.verdict === 'approve' ? 'approve' : 'reject',
          reason: typeof s.reason === 'string' ? s.reason : '',
        }))
      : [];
    const reason = typeof json.reason === 'string' ? json.reason : '';
    // With per-candidate scores, enforce the production floor in code (ignore model leniency).
    if (scores.length > 0) {
      const publishable = scores.filter(isPublishable);
      if (json.rejectAll === true || publishable.length === 0) {
        return { scores, winnerIndex: null, rejectAll: true, reason, source: 'critic' };
      }
      return { scores, winnerIndex: bestByScore(publishable), rejectAll: false, reason, source: 'critic' };
    }
    // No scores array — trust the model's verdict as-is.
    if (json.rejectAll === true) return { scores, winnerIndex: null, rejectAll: true, reason, source: 'critic' };
    const w = Number(json.winnerIndex);
    return { scores, winnerIndex: Number.isInteger(w) && w >= 0 && w < n ? w : 0, rejectAll: false, reason, source: 'critic' };
  } catch {
    return { scores: [], winnerIndex: 0, rejectAll: false, reason: 'critic error', source: 'error' };
  }
}
