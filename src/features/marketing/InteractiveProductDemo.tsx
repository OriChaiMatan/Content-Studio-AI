import { useEffect, useState } from 'react';
import {
  ITEMS6, ROW_TOPS, STEPS5, DEMO_THESIS_TEXT, OUTPUTS4, DEMO_TIMELINE as T,
  lerp, clamp01, easeInOutCubic, sceneCut,
} from './demoContent';
import { useIsMobile } from '../../hooks/useIsMobile';

// Collect scene (Scene 1) per-chip choreography: fade in, hold so it's
// readable, then travel to the case. Tuned to feel like a deliberate arrival
// rather than several items being thrown in at once.
const COLLECT_STAGGER_MS = 800; // gap between each chip starting its own sequence
const COLLECT_FADE_MS = 260;    // fade in at the inbox
const COLLECT_HOLD_MS = 560;    // sits still, fully readable, before moving
const COLLECT_FLY_MS = 820;     // slow, eased travel into the case
const COLLECT_ITEM_MS = COLLECT_FADE_MS + COLLECT_HOLD_MS + COLLECT_FLY_MS;

// Mobile-only scene 6/9 stage badge coloring — mirrors the desktop Scene 3
// badge palette (blue = active, green = done, grey = pending) so the mobile
// checklists stay on-brand without duplicating desktop's own step logic.
function stepBadgeStyle(state: 'pending' | 'active' | 'done') {
  if (state === 'active') return { badgeBg: 'rgba(77,130,232,0.16)', badgeColor: '#B1C5FF', badgeBorder: 'rgba(77,130,232,0.55)', textColor: '#E9EBFF', pulseAnim: 'marketing-stepPulse 1.6s ease-in-out infinite', lineColor: 'rgba(255,255,255,0.1)' };
  if (state === 'done') return { badgeBg: 'rgba(63,207,160,0.16)', badgeColor: '#3FCFA0', badgeBorder: 'rgba(63,207,160,0.5)', textColor: '#E9EBFF', pulseAnim: 'none', lineColor: 'rgba(63,207,160,0.5)' };
  return { badgeBg: 'rgba(255,255,255,0.05)', badgeColor: '#7C87A8', badgeBorder: 'rgba(255,255,255,0.14)', textColor: '#7C87A8', pulseAnim: 'none', lineColor: 'rgba(255,255,255,0.1)' };
}

// Scene 6 (Pipeline) mobile stage copy — same beat ("the pipeline runs, fact-
// checked, in real time") as the desktop iframe mockup, told as a checklist.
const PIPELINE_STAGES_MOBILE = [
  { label: 'Ingesting sources', detail: 'Pulling in every linked article, PDF and note.' },
  { label: 'Fact-checking claims', detail: 'Cross-referencing each claim against its source.' },
  { label: 'Drafting content', detail: 'Writing platform-ready drafts from the thesis.' },
  { label: 'Ready for review', detail: 'Four channels, one approval queue.' },
];

// Scene 9 (Library) mobile copy — same beat ("every case, saved and
// organized") as the desktop iframe mockup, told as a simple case list.
const LIBRARY_ITEMS_MOBILE = [
  { title: 'AI and the Knowledge Economy', status: 'Completed', statusColor: '#3FCFA0' },
  { title: 'The Future of Search', status: 'In Review', statusColor: '#B1C5FF' },
  { title: 'Attention Economics in 2026', status: 'Completed', statusColor: '#3FCFA0' },
];

export function InteractiveProductDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const isMobile = useIsMobile(900);

  // Reset the timeline during render (React's documented pattern for "reset
  // state when a prop changes") rather than in an effect — takes effect in the
  // same render pass `open` flips true, so there's no stale-frame flash and no
  // synchronous setState-in-effect. The interval itself (a real subscription)
  // still lives in the effect below, keyed on `open` so React's own dependency
  // diffing (not hand-rolled "was it open last time" bookkeeping) governs
  // start/stop — that hand-rolled version was fragile under batched updates.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setElapsed(0);
  }

  useEffect(() => {
    if (!open) return;
    const startedAt = performance.now();
    const cap = (T.final[0] as number) + 3000;
    const id = setInterval(() => {
      const e = performance.now() - startedAt;
      if (e >= cap) { setElapsed(cap); clearInterval(id); } else { setElapsed(e); }
    }, 50);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open && elapsed === 0) return null;

  const t = elapsed;

  // Scene 1: Collect
  const s1Opacity = sceneCut(t, T.s1[0], T.s1[1]);
  const s1Items = ITEMS6.map((it, i) => {
    const t0 = i * COLLECT_STAGGER_MS;
    const localT = t - T.s1[0] - t0; // ms into this chip's own fade/hold/fly sequence
    const startLeft = 5, endLeft = 84, startTop = ROW_TOPS[i], endTop = 50;
    let opacity = 0, left = startLeft, top = startTop, scale = 1;
    if (localT > 0) {
      if (localT < COLLECT_FADE_MS) {
        opacity = localT / COLLECT_FADE_MS;
      } else if (localT < COLLECT_FADE_MS + COLLECT_HOLD_MS) {
        opacity = 1;
      } else {
        const fp = clamp01((localT - COLLECT_FADE_MS - COLLECT_HOLD_MS) / COLLECT_FLY_MS);
        const te = easeInOutCubic(fp);
        left = lerp(startLeft, endLeft, te);
        top = lerp(startTop, endTop, te);
        opacity = fp > 0.55 ? Math.max(0, 1 - (fp - 0.55) / 0.45) : 1;
        scale = lerp(1, 0.55, te);
      }
    }
    return { ...it, left, top, opacity, scale };
  });
  let s1Count = 0;
  ITEMS6.forEach((_, i) => {
    const localT = t - T.s1[0] - i * COLLECT_STAGGER_MS;
    if (localT >= COLLECT_ITEM_MS * 0.92) s1Count++;
  });
  const s1CountSuffix = s1Count === 1 ? '' : 's';
  // Mobile Scene 1: same per-item stagger/fade/hold/fly windows (identical
  // pacing to desktop) but mapped to a vertical list — items fade in and stay
  // in place, then pick up a "collected" checkmark during what would be the
  // desktop fly phase, instead of flying across a canvas.
  const s1MobileItems = ITEMS6.map((it, i) => {
    const t0 = i * COLLECT_STAGGER_MS;
    const localT = t - T.s1[0] - t0;
    let opacity = 0, collectedOpacity = 0;
    if (localT > 0) {
      if (localT < COLLECT_FADE_MS) {
        opacity = localT / COLLECT_FADE_MS;
      } else {
        opacity = 1;
        if (localT >= COLLECT_FADE_MS + COLLECT_HOLD_MS) {
          collectedOpacity = clamp01((localT - COLLECT_FADE_MS - COLLECT_HOLD_MS) / COLLECT_FLY_MS);
        }
      }
    }
    return { ...it, opacity, collectedOpacity };
  });

  // Scene 2: Organize
  const s2Opacity = sceneCut(t, T.s2[0], T.s2[1]);
  const p2 = clamp01((t - T.s2[0]) / (T.s2[1] - T.s2[0]));
  const s2Items = ITEMS6.map((it, i) => {
    const local = clamp01((p2 - i * 0.11) / 0.32);
    const checkLocal = clamp01((p2 - i * 0.11 - 0.15) / 0.2);
    return { ...it, opacity: local, transform: `translateY(${lerp(-10, 0, local).toFixed(1)}px)`, checkOpacity: checkLocal };
  });
  let s2Count = 0;
  ITEMS6.forEach((_, i) => { if (clamp01((p2 - i * 0.11) / 0.32) >= 0.99) s2Count++; });
  const s2StatusOpacity = clamp01((p2 - 0.82) / 0.15);

  // Scene 3: Analyze
  const s3Opacity = sceneCut(t, T.s3[0], T.s3[1]);
  const p3 = clamp01((t - T.s3[0]) / (T.s3[1] - T.s3[0]));
  const stepShare = 1 / STEPS5.length;
  const s3Steps = STEPS5.map((st, i) => {
    const stepStart = i * stepShare, stepEnd = (i + 1) * stepShare;
    let state: 'pending' | 'active' | 'done' = 'pending';
    if (p3 >= stepEnd) state = 'done';
    else if (p3 >= stepStart) state = 'active';
    const isLast = i === STEPS5.length - 1;
    let badgeBg = 'rgba(255,255,255,0.05)', badgeColor = '#7C87A8', badgeBorder = 'rgba(255,255,255,0.14)', textColor = '#7C87A8', pulseAnim = 'none', lineColor = 'rgba(255,255,255,0.1)';
    if (state === 'active') { badgeBg = 'rgba(77,130,232,0.16)'; badgeColor = '#B1C5FF'; badgeBorder = 'rgba(77,130,232,0.55)'; textColor = '#E9EBFF'; pulseAnim = 'marketing-stepPulse 1.6s ease-in-out infinite'; }
    if (state === 'done') { badgeBg = 'rgba(63,207,160,0.16)'; badgeColor = '#3FCFA0'; badgeBorder = 'rgba(63,207,160,0.5)'; textColor = '#E9EBFF'; lineColor = 'rgba(63,207,160,0.5)'; }
    return {
      label: st.label, detail: st.detail, badgeBg, badgeColor, badgeBorder, textColor, pulseAnim,
      showCheck: state === 'done', showSpinner: state === 'active', showNum: state === 'pending', num: i + 1,
      showLine: !isLast, lineColor, detailOpacity: state === 'pending' ? 0.45 : 1,
    };
  });

  // Scene 4: Thesis
  const s4Opacity = sceneCut(t, T.s4[0], T.s4[1]);
  const p4 = clamp01((t - T.s4[0]) / (T.s4[1] - T.s4[0]));
  const s4CardOpacity = clamp01(p4 / 0.12);
  const s4Scale = 0.92 + Math.min(p4 / 0.12, 1) * 0.08;
  const typeProgress = clamp01((p4 - 0.16) / 0.62);
  const charCount = Math.floor(typeProgress * DEMO_THESIS_TEXT.length);
  const s4TypedText = DEMO_THESIS_TEXT.slice(0, charCount);
  const s4CursorOpacity = typeProgress < 1 ? (Math.floor(t / 400) % 2 === 0 ? 1 : 0) : 0;

  // Scene 5: Outputs
  const s5Opacity = sceneCut(t, T.s5[0], T.s5[1]);
  const p5 = clamp01((t - T.s5[0]) / (T.s5[1] - T.s5[0]));
  const s5Outputs = OUTPUTS4.map((o, i) => {
    const local = clamp01((p5 - 0.12 - i * 0.14) / 0.28);
    return { ...o, opacity: local, transform: `translateY(${lerp(18, 0, local).toFixed(1)}px)` };
  });

  // Scenes 6-9: live product UI mockups (self-contained iframes with their own
  // internal timers/animations — the parent only decides *when* each mounts,
  // never reaches into their internals). Each lazy-mounts exactly at its own
  // scene start and unmounts when its scene ends: mounting is what starts the
  // iframe's internal animation, so it must stay mounted for the whole of its
  // own window (never torn down mid-scene) but has no reason to keep running
  // once its scene has passed.
  const s6Opacity = sceneCut(t, T.s6[0], T.s6[1]);
  const s6Mounted = s6Opacity === 1;
  const s7Opacity = sceneCut(t, T.s7[0], T.s7[1]);
  const s7Mounted = s7Opacity === 1;
  const s8Opacity = sceneCut(t, T.s8[0], T.s8[1]);
  const s8Mounted = s8Opacity === 1;
  const s9Opacity = sceneCut(t, T.s9[0], T.s9[1]);
  const s9Mounted = s9Opacity === 1;
  const s9Scale = 900 / 1100;

  // Mobile Scenes 6-9: same scene start/end boundaries (T.s6..T.s9, identical
  // timing to desktop) but progress is expressed as a 0-1 fraction driving a
  // dedicated mobile layout (checklist / vertical review list / progress bar
  // / case list) instead of scaling the desktop iframes down.
  const p6 = clamp01((t - T.s6[0]) / (T.s6[1] - T.s6[0]));
  const stage6Share = 1 / PIPELINE_STAGES_MOBILE.length;
  const s6MobileStages = PIPELINE_STAGES_MOBILE.map((st, i) => {
    const stepStart = i * stage6Share, stepEnd = (i + 1) * stage6Share;
    let state: 'pending' | 'active' | 'done' = 'pending';
    if (p6 >= stepEnd) state = 'done';
    else if (p6 >= stepStart) state = 'active';
    const badge = stepBadgeStyle(state);
    return { label: st.label, detail: st.detail, ...badge, showCheck: state === 'done', showSpinner: state === 'active', showNum: state === 'pending', num: i + 1, showLine: i !== PIPELINE_STAGES_MOBILE.length - 1, detailOpacity: state === 'pending' ? 0.45 : 1 };
  });

  const p7 = clamp01((t - T.s7[0]) / (T.s7[1] - T.s7[0]));
  const s7MobileOutputs = OUTPUTS4.map((o, i) => {
    const local = clamp01((p7 - 0.08 - i * 0.16) / 0.3);
    const approveOpacity = clamp01((p7 - 0.08 - i * 0.16 - 0.16) / 0.2);
    return { ...o, opacity: local, transform: `translateY(${lerp(14, 0, local).toFixed(1)}px)`, approveOpacity };
  });

  const p8 = clamp01((t - T.s8[0]) / (T.s8[1] - T.s8[0]));

  const p9 = clamp01((t - T.s9[0]) / (T.s9[1] - T.s9[0]));
  const s9MobileItems = LIBRARY_ITEMS_MOBILE.map((it, i) => {
    const local = clamp01((p9 - 0.1 - i * 0.2) / 0.3);
    return { ...it, opacity: local, transform: `translateY(${lerp(12, 0, local).toFixed(1)}px)` };
  });

  // Final
  const finalOpacity = sceneCut(t, T.final[0], T.final[1]);
  // Must also gate on `open`: this is a full-viewport `inset:0` div, and its
  // pointer-events explicitly override the parent's — if this stayed 'auto'
  // after the parent closes (t stays >= T.final[0] forever once reached),
  // it would sit invisibly over the whole page blocking every click.
  const finalPointerEvents = open && t >= T.final[0] ? 'auto' : 'none';

  const browserChrome = (label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#141828', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FEBC2E' }} />
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
      <span style={{ marginLeft: 8, fontSize: 11, color: '#7C87A8', fontWeight: 600 }}>{label}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: '#07090F',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        display: open || t > 0 ? 'block' : 'none',
        transition: 'opacity 0.5s ease', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: 'hidden',
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', top: 28, right: 32, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#B1C5FF', fontSize: 16 }}>✕</div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 900px 700px at 50% 40%, rgba(9,76,178,0.16) 0%, transparent 70%)' }} />

      {!isMobile ? (
        <>
          {/* Scene 1: Collect */}
          <div style={{ position: 'absolute', inset: 0, opacity: s1Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 10 }}>Scene 01 — Collect</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E9EBFF' }}>Every source, in one place.</div>
            </div>
            <div style={{ position: 'relative', width: 'min(820px,90vw)', height: 'min(440px,50vh)' }}>
              <div style={{ position: 'absolute', left: 0, top: '6%', width: '44%', height: '88%', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <div style={{ position: 'absolute', top: 14, left: 18, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C87A8' }}>Inbox</div>
              </div>
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 210, background: 'rgba(20,24,40,0.96)', border: '1px solid rgba(77,130,232,0.4)', borderRadius: 18, padding: '22px 20px', textAlign: 'center', boxShadow: '0 0 50px rgba(9,76,178,0.3), 0 0 0 10px rgba(7,9,15,0.9)', animation: 'marketing-softGlow 3.5s ease-in-out infinite' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7C87A8', marginBottom: 8 }}>LumAI Research Case</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#B1C5FF', fontVariantNumeric: 'tabular-nums' }}>{s1Count}</div>
                <div style={{ fontSize: 12, color: '#7C87A8', marginTop: 2 }}>source{s1CountSuffix} added</div>
              </div>
              {s1Items.map((it) => (
                <div key={it.name} style={{ position: 'absolute', left: it.left + '%', top: it.top + '%', transform: `translate(0,-50%) scale(${it.scale.toFixed(2)})`, opacity: it.opacity, width: 230, background: 'rgba(20,24,40,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: it.accent }}>{it.mono}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EBFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: '#8A94B8' }}>{it.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scene 2: Organize */}
          <div style={{ position: 'absolute', inset: 0, opacity: s2Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 10 }}>Scene 02 — Organize</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E9EBFF' }}>A clean list, ready to reason over.</div>
            </div>
            <div style={{ position: 'relative', width: 'min(560px,88vw)', background: 'rgba(20,24,40,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '14px 18px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7C87A8' }}>Research Case — Sources</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#B1C5FF' }}>{s2Count}/6</span>
              </div>
              {s2Items.map((it) => (
                <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', opacity: it.opacity, transform: it.transform, transition: 'opacity 0.45s ease, transform 0.45s ease' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: it.accent }}>{it.mono}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#E9EBFF' }}>{it.name}</div>
                    <div style={{ fontSize: 10.5, color: '#8A94B8' }}>{it.type}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(63,207,160,0.18)', border: '1px solid #3FCFA0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: '#3FCFA0', flexShrink: 0, opacity: it.checkOpacity, transition: 'opacity 0.3s ease' }}>✓</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7C87A8', opacity: s2StatusOpacity, transition: 'opacity 0.5s ease' }}>6 sources organized.</div>
          </div>

          {/* Scene 3: Analyze */}
          <div style={{ position: 'absolute', inset: 0, opacity: s3Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 10 }}>Scene 03 — Analyze</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E9EBFF' }}>LumAI does the reasoning.</div>
            </div>
            <div style={{ position: 'relative', width: 'min(600px,88vw)', display: 'flex', flexDirection: 'column' }}>
              {s3Steps.map((st) => (
                <div key={st.label} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: st.badgeBg, color: st.badgeColor, border: `1.5px solid ${st.badgeBorder}`, transition: 'all 0.35s ease', animation: st.pulseAnim }}>
                      {st.showCheck && <span>✓</span>}
                      {st.showSpinner && <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#4D82E8', animation: 'marketing-spin 0.8s linear infinite' }} />}
                      {st.showNum && <span>{st.num}</span>}
                    </div>
                    {st.showLine && <div style={{ width: 2, flex: 1, minHeight: 26, background: st.lineColor, transition: 'background 0.4s ease' }} />}
                  </div>
                  <div style={{ paddingBottom: 26, flex: 1 }}>
                    <div style={{ fontSize: 16.5, fontWeight: 700, color: st.textColor, transition: 'color 0.35s ease' }}>{st.label}</div>
                    <div style={{ fontSize: 12.5, color: '#8A94B8', marginTop: 4, opacity: st.detailOpacity, transition: 'opacity 0.4s ease' }}>{st.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scene 4: Thesis */}
          <div style={{ position: 'absolute', inset: 0, opacity: s4Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 10 }}>Scene 04 — Thesis</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E9EBFF' }}>One clear point of view.</div>
            </div>
            <div style={{ width: 560, maxWidth: '86vw', transform: `scale(${s4Scale.toFixed(2)})`, opacity: s4CardOpacity, transition: 'opacity 0.6s ease' }}>
              <div style={{ background: 'rgba(9,76,178,0.12)', border: '1.5px solid rgba(77,130,232,0.5)', borderRadius: 22, padding: '40px 44px', boxShadow: '0 0 90px rgba(9,76,178,0.35)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C87A8', marginBottom: 18 }}>Thesis</div>
                <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontWeight: 600, fontSize: 25, lineHeight: 1.6, color: '#B1C5FF', minHeight: 120 }}>
                  {s4TypedText}<span style={{ opacity: s4CursorOpacity }}>|</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scene 5: Outputs */}
          <div style={{ position: 'absolute', inset: 0, opacity: s5Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 10 }}>Scene 05 — Create Outputs</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E9EBFF' }}>From one thesis, every channel.</div>
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
              {s5Outputs.map((o) => (
                <div key={o.name} style={{ width: 210, background: 'rgba(20,24,40,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, opacity: o.opacity, transform: o.transform, transition: 'opacity 0.55s ease, transform 0.55s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', background: o.accent }}>{o.mono}</div>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: '#E9EBFF' }}>{o.name}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9AA3C0', lineHeight: 1.55 }}>{o.preview}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scene 6: Pipeline */}
          <div style={{ position: 'absolute', inset: 0, opacity: s6Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 06 — Pipeline</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#E9EBFF' }}>Research, fact-checked, in real time.</div>
            </div>
            <div style={{ width: 525, maxWidth: '90vw', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', background: '#0D1121' }}>
              {browserChrome('LumAI — Research Pipeline')}
              <div style={{ width: 525, height: 675, maxHeight: '74vh', overflow: 'hidden' }}>
                {s6Mounted && (
                  <div style={{ width: 700, height: 900, transform: 'scale(0.75)', transformOrigin: 'top left' }}>
                    <iframe src="/marketing-demo/pipeline.html" style={{ width: 700, height: 900, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" tabIndex={-1} title="Pipeline demo" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scene 7: Review */}
          <div style={{ position: 'absolute', inset: 0, opacity: s7Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 07 — Review</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#E9EBFF' }}>Four channels. One approval flow.</div>
            </div>
            <div style={{ width: 'min(920px,92vw)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', background: '#0D1121' }}>
              {browserChrome('LumAI — Review & Approve')}
              <div style={{ width: '100%', height: 534, maxHeight: '58vh', overflow: 'hidden' }}>
                {s7Mounted && (
                  <div style={{ width: 920, height: 534, transform: 'scale(1)', transformOrigin: 'top left' }}>
                    <iframe src="/marketing-demo/review.html" style={{ width: 920, height: 534, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" tabIndex={-1} title="Review demo" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scene 8: Image Generation */}
          <div style={{ position: 'absolute', inset: 0, opacity: s8Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 08 — Image Generation</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#E9EBFF' }}>A visual for LinkedIn and Facebook.</div>
            </div>
            <div style={{ width: 700, maxWidth: '90vw', height: 600, maxHeight: '64vh', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', background: '#0D1121' }}>
              {browserChrome('LumAI — Visual')}
              <div style={{ width: '100%', height: 'calc(100% - 37px)', overflow: 'hidden' }}>
                {s8Mounted && (
                  <div style={{ width: 700, height: 563, transform: 'scale(1)', transformOrigin: 'top left' }}>
                    <iframe src="/marketing-demo/image-generation.html" style={{ width: 700, height: 563, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" tabIndex={-1} title="Image generation demo" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scene 9: Library */}
          <div style={{ position: 'absolute', inset: 0, opacity: s9Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 09 — Library</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#E9EBFF' }}>Every case, saved and organized.</div>
            </div>
            <div style={{ width: 'min(920px,92vw)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', background: '#0D1121' }}>
              {browserChrome('LumAI — Library')}
              <div style={{ width: '100%', height: 534, maxHeight: '58vh', overflow: 'hidden' }}>
                {s9Mounted && (
                  <div style={{ width: 1100, height: 700, transform: `scale(${s9Scale.toFixed(3)})`, transformOrigin: 'top left' }}>
                    <iframe src="/marketing-demo/library.html" style={{ width: 1100, height: 700, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" tabIndex={-1} title="Library demo" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Final frame */}
          <div style={{ position: 'absolute', inset: 0, opacity: finalOpacity, pointerEvents: finalPointerEvents as React.CSSProperties['pointerEvents'], background: '#07090F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <rect width="56" height="56" rx="14" fill="#094CB2" />
              <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.2, color: '#E9EBFF' }}>One thesis.<br />Every channel.</div>
            </div>
            <div onClick={onClose} style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 16, padding: '16px 40px', borderRadius: 12, boxShadow: '0 4px 20px rgba(30,84,200,0.45)', cursor: 'pointer' }}>Start with your sources</div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile Scene 1: Collect — vertical arrival list instead of a
              cross-canvas flight animation. Same stagger/fade/hold timing. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s1Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 01 — Collect</div>
              <div style={{ fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#E9EBFF' }}>Every source, in one place.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, background: 'rgba(20,24,40,0.96)', border: '1px solid rgba(77,130,232,0.4)', borderRadius: 16, padding: '16px 20px', textAlign: 'center', boxShadow: '0 0 40px rgba(9,76,178,0.25)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7C87A8', marginBottom: 6 }}>LumAI Research Case</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#B1C5FF', fontVariantNumeric: 'tabular-nums' }}>{s1Count}</div>
              <div style={{ fontSize: 11.5, color: '#7C87A8', marginTop: 2 }}>source{s1CountSuffix} added</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s1MobileItems.map((it) => (
                <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: it.opacity, transition: 'opacity 0.3s ease', background: 'rgba(20,24,40,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: it.accent }}>{it.mono}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EBFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: '#8A94B8' }}>{it.type}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(63,207,160,0.18)', border: '1px solid #3FCFA0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: '#3FCFA0', flexShrink: 0, opacity: it.collectedOpacity, transition: 'opacity 0.3s ease' }}>✓</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Scene 2: Organize — same clean stacked list as desktop
              (already vertical), just sized for a narrow screen. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s2Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 02 — Organize</div>
              <div style={{ fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#E9EBFF' }}>A clean list, ready to reason over.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, background: 'rgba(20,24,40,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#7C87A8' }}>Sources</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B1C5FF' }}>{s2Count}/6</span>
              </div>
              {s2Items.map((it) => (
                <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', opacity: it.opacity, transform: it.transform, transition: 'opacity 0.45s ease, transform 0.45s ease' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', background: it.accent }}>{it.mono}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EBFF' }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: '#8A94B8' }}>{it.type}</div>
                  </div>
                  <div style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(63,207,160,0.18)', border: '1px solid #3FCFA0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#3FCFA0', flexShrink: 0, opacity: it.checkOpacity, transition: 'opacity 0.3s ease' }}>✓</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#7C87A8', opacity: s2StatusOpacity, transition: 'opacity 0.5s ease' }}>6 sources organized.</div>
          </div>

          {/* Mobile Scene 3: Analyze — same vertical step list as desktop
              (already mobile-shaped), sized for a narrow screen. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s3Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 03 — Analyze</div>
              <div style={{ fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#E9EBFF' }}>LumAI does the reasoning.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column' }}>
              {s3Steps.map((st) => (
                <div key={st.label} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: st.badgeBg, color: st.badgeColor, border: `1.5px solid ${st.badgeBorder}`, transition: 'all 0.35s ease', animation: st.pulseAnim }}>
                      {st.showCheck && <span>✓</span>}
                      {st.showSpinner && <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#4D82E8', animation: 'marketing-spin 0.8s linear infinite' }} />}
                      {st.showNum && <span>{st.num}</span>}
                    </div>
                    {st.showLine && <div style={{ width: 2, flex: 1, minHeight: 22, background: st.lineColor, transition: 'background 0.4s ease' }} />}
                  </div>
                  <div style={{ paddingBottom: 20, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: st.textColor, transition: 'color 0.35s ease' }}>{st.label}</div>
                    <div style={{ fontSize: 11.5, color: '#8A94B8', marginTop: 3, opacity: st.detailOpacity, transition: 'opacity 0.4s ease' }}>{st.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Scene 4: Thesis — vertical single-card presentation
              (full-width card rather than the desktop's fixed 560px card). */}
          <div style={{ position: 'absolute', inset: 0, opacity: s4Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 04 — Thesis</div>
              <div style={{ fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#E9EBFF' }}>One clear point of view.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, transform: `scale(${s4Scale.toFixed(2)})`, opacity: s4CardOpacity, transition: 'opacity 0.6s ease' }}>
              <div style={{ background: 'rgba(9,76,178,0.12)', border: '1.5px solid rgba(77,130,232,0.5)', borderRadius: 18, padding: '26px 22px', boxShadow: '0 0 60px rgba(9,76,178,0.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7C87A8', marginBottom: 14 }}>Thesis</div>
                <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontWeight: 600, fontSize: 17, lineHeight: 1.55, color: '#B1C5FF', minHeight: 110 }}>
                  {s4TypedText}<span style={{ opacity: s4CursorOpacity }}>|</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Scene 5: Outputs — vertical pipeline: one thesis flowing
              down into four stacked channel cards, instead of a wrapped row. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s5Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 22 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 05 — Create Outputs</div>
              <div style={{ fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#E9EBFF' }}>From one thesis, every channel.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {s5Outputs.map((o) => (
                <div key={o.name} style={{ width: '100%', background: 'rgba(20,24,40,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, opacity: o.opacity, transform: o.transform, transition: 'opacity 0.55s ease, transform 0.55s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', background: o.accent }}>{o.mono}</div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#E9EBFF' }}>{o.name}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9AA3C0', lineHeight: 1.5 }}>{o.preview}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Scene 6: Pipeline — a checklist standing in for the live
              iframe mockup, same "fact-checked in real time" beat, same
              badge/checkmark visual language as Scene 3. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s6Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 06 — Pipeline</div>
              <div style={{ fontSize: 'clamp(18px, 5.5vw, 22px)', fontWeight: 700, color: '#E9EBFF' }}>Research, fact-checked, in real time.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#0D1121' }}>
              {browserChrome('LumAI — Research Pipeline')}
              <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
                {s6MobileStages.map((st) => (
                  <div key={st.label} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: st.badgeBg, color: st.badgeColor, border: `1.5px solid ${st.badgeBorder}`, transition: 'all 0.35s ease', animation: st.pulseAnim }}>
                        {st.showCheck && <span>✓</span>}
                        {st.showSpinner && <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#4D82E8', animation: 'marketing-spin 0.8s linear infinite' }} />}
                        {st.showNum && <span>{st.num}</span>}
                      </div>
                      {st.showLine && <div style={{ width: 2, flex: 1, minHeight: 18, background: st.lineColor, transition: 'background 0.4s ease' }} />}
                    </div>
                    <div style={{ paddingBottom: 16, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: st.textColor, transition: 'color 0.35s ease' }}>{st.label}</div>
                      <div style={{ fontSize: 10.5, color: '#8A94B8', marginTop: 2, opacity: st.detailOpacity, transition: 'opacity 0.4s ease' }}>{st.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Scene 7: Review — the four channel outputs as a vertical
              stack, each with its own approve/reject row, same "one approval
              flow" beat as the desktop iframe. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s7Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 07 — Review</div>
              <div style={{ fontSize: 'clamp(18px, 5.5vw, 22px)', fontWeight: 700, color: '#E9EBFF' }}>Four channels. One approval flow.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#0D1121' }}>
              {browserChrome('LumAI — Review & Approve')}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s7MobileOutputs.map((o) => (
                  <div key={o.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, opacity: o.opacity, transform: o.transform, transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: o.accent }}>{o.mono}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#E9EBFF' }}>{o.name}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#9AA3C0', lineHeight: 1.45, marginBottom: 8 }}>{o.preview}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: o.approveOpacity, transition: 'opacity 0.4s ease' }}>
                      <div style={{ textAlign: 'center', background: '#1E54C8', color: 'white', borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 700 }}>✓ Approve</div>
                      <div style={{ textAlign: 'center', border: '1px solid rgba(255,255,255,0.12)', color: '#9AA3C0', borderRadius: 8, padding: '9px 0', fontSize: 12 }}>↻ Regenerate</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Scene 8: Image Generation — a placeholder visual card
              with a progress indicator, same "generating a visual" beat. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s8Opacity, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 08 — Image Generation</div>
              <div style={{ fontSize: 'clamp(18px, 5.5vw, 22px)', fontWeight: 700, color: '#E9EBFF' }}>A visual for LinkedIn and Facebook.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#0D1121' }}>
              {browserChrome('LumAI — Visual')}
              <div style={{ padding: 20 }}>
                <div style={{ width: '100%', height: 160, borderRadius: 12, background: 'linear-gradient(135deg, rgba(9,76,178,0.35), rgba(77,130,232,0.15))', border: '1px solid rgba(77,130,232,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🖼️</div>
                <div style={{ fontSize: 12, color: '#9AA3C0', marginTop: 12 }}>Generating visual for LinkedIn &amp; Facebook…</div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ width: `${Math.round(p8 * 100)}%`, height: '100%', background: 'linear-gradient(to right,#094CB2,#4D82E8)', transition: 'width 0.2s linear' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Scene 9: Library — a simple vertical case list, same
              "every case, saved and organized" beat as the desktop iframe. */}
          <div style={{ position: 'absolute', inset: 0, opacity: s9Opacity, pointerEvents: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '90px 20px 40px', gap: 18 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B1C5FF', marginBottom: 8 }}>Scene 09 — Library</div>
              <div style={{ fontSize: 'clamp(18px, 5.5vw, 22px)', fontWeight: 700, color: '#E9EBFF' }}>Every case, saved and organized.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#0D1121' }}>
              {browserChrome('LumAI — Library')}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s9MobileItems.map((it) => (
                  <div key={it.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', opacity: it.opacity, transform: it.transform, transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#E9EBFF', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: it.statusColor, flexShrink: 0 }}>{it.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Final frame */}
          <div style={{ position: 'absolute', inset: 0, opacity: finalOpacity, pointerEvents: finalPointerEvents as React.CSSProperties['pointerEvents'], background: '#07090F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 24px' }}>
            <svg width="48" height="48" viewBox="0 0 56 56">
              <rect width="56" height="56" rx="14" fill="#094CB2" />
              <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(24px, 7vw, 30px)', fontWeight: 700, lineHeight: 1.25, color: '#E9EBFF' }}>One thesis.<br />Every channel.</div>
            </div>
            <div onClick={onClose} style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, boxShadow: '0 4px 20px rgba(30,84,200,0.45)', cursor: 'pointer', textAlign: 'center' }}>Start with your sources</div>
          </div>
        </>
      )}
    </div>
  );
}
