import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NetworkCanvas, RiseCanvas } from './canvases';
import {
  SOURCE_DEFS, OUTPUT_DEFS, EVIDENCE_DEFS, THESIS_TEXT,
  THINK_SOURCE_DEFS, THINK_OUTPUT_DEFS,
  REASON_SOURCES, REASON_CONNECTIONS, REASON_CAPTIONS, SYNTHESIS_CENTER,
  CAPTURE_CENTER, CAPTURE_ORIGINS, CAPTURE_CYCLE_MS, CAPTURE_STATUS_TIERS,
  REASON_INSIGHT_WORDS, REASON_OUTCOMES, REASON_STAGE_COPY,
  PROBLEM_SOURCE_POS, PROBLEM_SIGNAL_DEFS, FAQ_DEFS, USE_CASE_DEFS,
  lerp, clamp01,
} from './content';

const TYPED_THESIS_FULL = 'The AI companies saving the web may also be weakening the economics that keep the web alive.';

type EngineState = {
  loadStage: number;
  heroAct: number;
  demoOpen: boolean;
  problemPhase: number;
  reasoningPct: number;
  flowStep: number;
  typedThesis: string;
  cursorOn: boolean;
  faqOpen: number;
  faqFill: number;
  pricingHoverIdx: number | null;
  mouseX: number;
  mouseY: number;
  scrolled: boolean;
  captureTick: number;
  captureSubT: number;
};

const initialState: EngineState = {
  loadStage: 0,
  heroAct: 0,
  demoOpen: false,
  problemPhase: 0,
  reasoningPct: 0,
  flowStep: 1,
  typedThesis: '',
  cursorOn: true,
  faqOpen: -1,
  faqFill: 0,
  pricingHoverIdx: null,
  mouseX: -400,
  mouseY: -400,
  scrolled: false,
  captureTick: 0,
  captureSubT: 0,
};

export function useLandingEngine() {
  const [s, setS] = useState<EngineState>(initialState);

  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroForegroundRef = useRef<HTMLElement | null>(null);
  const ctaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chaosRef = useRef<HTMLElement | null>(null);
  const exampleRef = useRef<HTMLElement | null>(null);
  const flowRef = useRef<HTMLElement | null>(null);
  const reasonRef = useRef<HTMLElement | null>(null);
  const captureRef = useRef<HTMLElement | null>(null);
  const demoScrollYRef = useRef(0);
  const demoOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const set = (patch: Partial<EngineState>) => setS((prev) => ({ ...prev, ...patch }));
    const after = (ms: number, patch: Partial<EngineState>) => {
      timeouts.push(setTimeout(() => set(patch), ms));
    };

    after(20, { loadStage: 1 });
    after(500, { loadStage: 2 });
    after(700, { loadStage: 3 });
    after(900, { loadStage: 4 });
    after(1200, { loadStage: 5 });

    after(400, { heroAct: 1 });
    after(1900, { heroAct: 2 });
    after(4300, { heroAct: 3 });
    after(5600, { heroAct: 4 });
    after(7200, { heroAct: 5 });

    let network: NetworkCanvas | null = null;
    let rise: RiseCanvas | null = null;
    if (heroCanvasRef.current) network = new NetworkCanvas(heroCanvasRef.current);
    if (ctaCanvasRef.current) rise = new RiseCanvas(ctaCanvasRef.current);

    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0) translateX(0)';
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => revealObs.observe(el));

    let problemStarted = false;
    let problemTimer: ReturnType<typeof setInterval> | undefined;
    let chaosObs: IntersectionObserver | undefined;
    if (chaosRef.current) {
      chaosObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && !problemStarted) {
              problemStarted = true;
              problemTimer = setInterval(() => {
                setS((prev) => ({ ...prev, problemPhase: (prev.problemPhase + 1) % 5 }));
              }, 2800);
              chaosObs?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.3 },
      );
      chaosObs.observe(chaosRef.current);
    }

    let typingStarted = false;
    let typingInterval: ReturnType<typeof setInterval> | undefined;
    let exampleObs: IntersectionObserver | undefined;
    if (exampleRef.current) {
      exampleObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && !typingStarted) {
              typingStarted = true;
              let i = 0;
              typingInterval = setInterval(() => {
                i++;
                set({ typedThesis: TYPED_THESIS_FULL.slice(0, i) });
                if (i >= TYPED_THESIS_FULL.length) {
                  if (typingInterval) clearInterval(typingInterval);
                  timeouts.push(setTimeout(() => set({ cursorOn: false }), 2000));
                }
              }, 28);
              exampleObs?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.4 },
      );
      exampleObs.observe(exampleRef.current);
    }

    const computeFlowStep = () => {
      const el = flowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight || rect.bottom < 0) return;
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const pct = total > 0 ? scrolled / total : 0;
      const step = pct < 0.2 ? 1 : pct < 0.4 ? 2 : pct < 0.6 ? 3 : pct < 0.8 ? 4 : 5;
      setS((prev) => (prev.flowStep === step ? prev : { ...prev, flowStep: step }));
    };
    window.addEventListener('scroll', computeFlowStep, { passive: true });
    computeFlowStep();

    const computeReasoningPct = () => {
      const el = reasonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight || rect.bottom < 0) return;
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const pct = total > 0 ? scrolled / total : 0;
      setS((prev) => (Math.abs(pct - prev.reasoningPct) > 0.002 ? { ...prev, reasoningPct: pct } : prev));
    };
    window.addEventListener('scroll', computeReasoningPct, { passive: true });
    window.addEventListener('resize', computeReasoningPct, { passive: true });
    computeReasoningPct();

    let captureStarted = false;
    let captureTimer: ReturnType<typeof setInterval> | undefined;
    let captureObs: IntersectionObserver | undefined;
    if (captureRef.current) {
      captureObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && !captureStarted) {
              captureStarted = true;
              captureTimer = setInterval(() => {
                setS((prev) => {
                  const nextSub = prev.captureSubT + 60 / CAPTURE_CYCLE_MS;
                  if (nextSub >= 1) return { ...prev, captureSubT: 0, captureTick: prev.captureTick + 1 };
                  return { ...prev, captureSubT: nextSub };
                });
              }, 60);
              captureObs?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.2 },
      );
      captureObs.observe(captureRef.current);
    }

    let navTicking = false;
    const onNavScroll = () => {
      if (navTicking) return;
      navTicking = true;
      requestAnimationFrame(() => {
        setS((prev) => {
          const scrolled = window.scrollY > 10;
          return scrolled === prev.scrolled ? prev : { ...prev, scrolled };
        });
        navTicking = false;
      });
    };
    window.addEventListener('scroll', onNavScroll, { passive: true });

    let mouseTicking = false;
    const onMouseMove = (e: MouseEvent) => {
      if (mouseTicking) return;
      mouseTicking = true;
      requestAnimationFrame(() => {
        set({ mouseX: e.clientX, mouseY: e.clientY });
        mouseTicking = false;
      });
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      timeouts.forEach(clearTimeout);
      network?.destroy();
      rise?.destroy();
      revealObs.disconnect();
      chaosObs?.disconnect();
      exampleObs?.disconnect();
      captureObs?.disconnect();
      if (problemTimer) clearInterval(problemTimer);
      if (typingInterval) clearInterval(typingInterval);
      if (captureTimer) clearInterval(captureTimer);
      window.removeEventListener('scroll', computeFlowStep);
      window.removeEventListener('scroll', computeReasoningPct);
      window.removeEventListener('resize', computeReasoningPct);
      window.removeEventListener('scroll', onNavScroll);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const skipLoad = () => { if (s.loadStage < 5) setS((prev) => ({ ...prev, loadStage: 5 })); };

  // Opening/closing the demo modal locks background scroll, remembers where the
  // page was so it can be restored, and remembers which button opened it so
  // focus can return there on close (matches the approved design's behavior).
  const openDemo = (e?: { currentTarget: HTMLElement }) => {
    demoScrollYRef.current = window.scrollY;
    demoOpenerRef.current = e?.currentTarget ?? null;
    document.body.style.overflow = 'hidden';
    setS((prev) => ({ ...prev, demoOpen: true }));
  };
  const closeDemo = () => {
    setS((prev) => ({ ...prev, demoOpen: false }));
    document.body.style.overflow = '';
    window.scrollTo(0, demoScrollYRef.current);
    demoOpenerRef.current?.focus();
  };
  const toggleFaq = (idx: number) => {
    setS((prev) => {
      if (prev.faqOpen === idx) return { ...prev, faqOpen: -1, faqFill: 0 };
      return { ...prev, faqOpen: idx, faqFill: 0 };
    });
    if (s.faqOpen !== idx) {
      requestAnimationFrame(() => requestAnimationFrame(() => setS((prev) => ({ ...prev, faqFill: 100 }))));
    }
  };
  const setPricingHover = (idx: number, on: boolean) => {
    setS((prev) => ({ ...prev, pricingHoverIdx: on ? idx : (prev.pricingHoverIdx === idx ? null : prev.pricingHoverIdx) }));
  };
  const onHeroTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroForegroundRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / rect.height) * -4;
    const ry = ((e.clientX - cx) / rect.width) * 4;
    el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onHeroTiltLeave = () => {
    const el = heroForegroundRef.current;
    if (el) el.style.transform = 'perspective(1200px) rotateX(0) rotateY(0)';
  };

  // ---- Derived render values (ported from the source's renderVals()) ----

  const loadOverlayOpacity = s.loadStage >= 5 ? 0 : 1;
  const logoLoadTransform = s.loadStage >= 3 ? 'translateY(-260px) scale(0.7)' : 'translateY(0) scale(1)';
  const logoLoadGlow = s.loadStage === 2 ? '0 0 24px rgba(77,130,232,0.4)' : 'none';
  const contentOpacity = s.loadStage >= 4 ? 1 : 0;
  const contentScale = s.loadStage >= 4 ? 'scale(1)' : 'scale(1.02)';

  const heroLine1 = s.heroAct >= 1 ? 1 : 0;
  const heroLine2 = s.heroAct >= 2 ? 1 : 0;
  const heroLine3 = s.heroAct >= 3 ? 1 : 0;
  const heroSub = s.heroAct >= 4 ? 1 : 0;

  const sourceCards = SOURCE_DEFS.map((d, i) => ({
    name: d.name, x: d.x, y: d.y, floatDur: 3 + i * 0.4 + 's',
    opacity: s.heroAct >= 1 ? 1 : 0, transform: s.heroAct >= 1 ? 'translateX(0)' : 'translateX(-20px)',
  }));
  const evidenceLabels = EVIDENCE_DEFS.map((d) => ({ text: d.text, x: d.x, y: d.y, opacity: s.heroAct >= 2 ? 1 : 0 }));
  const outputCards = OUTPUT_DEFS.map((d) => ({
    name: d.name, x: d.x, y: d.y, opacity: s.heroAct >= 4 ? 1 : 0,
    transform: s.heroAct >= 4 ? 'translate(0,0)' : 'translate(20px,-10px)',
  }));

  const flowSteps = ['Add Sources', 'LumAI Researches', 'Thesis Formation', 'Generate Outputs', 'Review'].map((label, i) => {
    const n = i + 1;
    const active = s.flowStep === n;
    const done = s.flowStep > n;
    return {
      label,
      dotBg: active ? '#4D82E8' : done ? 'rgba(77,130,232,0.4)' : 'transparent',
      dotBorder: active || done ? '#4D82E8' : 'rgba(255,255,255,0.2)',
      textColor: active ? '#E9EBFF' : '#606880',
    };
  });

  const outputTabs = ['LinkedIn', 'Facebook', 'Newsletter', 'Podcast'].map((n, i) => ({
    name: n, bg: i === 0 ? '#1E54C8' : 'transparent', color: i === 0 ? 'white' : '#A0A8C8',
    underline: i === 0 ? '2px solid #1E54C8' : '2px solid transparent',
  }));

  const faqItems = FAQ_DEFS.map((f, i) => ({
    q: f.q, a: f.a, isOpen: s.faqOpen === i, fill: (s.faqOpen === i ? s.faqFill : 0) + '%',
    icon: s.faqOpen === i ? '−' : '+', toggle: () => toggleFaq(i),
  }));

  const flowIsStep1 = s.flowStep === 1;
  const flowIsStep2 = s.flowStep === 2;
  const flowIsStep3 = s.flowStep === 3;
  const flowIsStep4 = s.flowStep === 4;
  const flowIsStep5 = s.flowStep === 5;

  const pricingHover0 = s.pricingHoverIdx === 0 ? '260px' : '0px';
  const pricingHover1 = s.pricingHoverIdx === 1 ? '220px' : '0px';

  // ---- Reasoning visualization (scroll-driven) ----
  const rpct = s.reasoningPct;
  const RB0 = 0.14, RB1 = 0.34, RB2 = 0.62, RB3 = 0.84;
  const reasonStageIndex = rpct < RB0 ? 0 : rpct < RB1 ? 1 : rpct < RB2 ? 2 : rpct < RB3 ? 3 : 4;
  const rt1 = clamp01((rpct - RB0) / (RB1 - RB0));
  const rt2 = clamp01((rpct - RB1) / (RB2 - RB1));
  const rt3 = clamp01((rpct - RB2) / (RB3 - RB2));
  const rt4 = clamp01((rpct - RB3) / (1 - RB3));

  let rejectSeen = 0;
  const totalRejects = REASON_SOURCES.filter((d) => !d.survive).length;
  const reasonSources = REASON_SOURCES.map((d) => {
    let left = d.base.left, top = d.base.top, opacity = 1, scale = 1, showReject = false, borderColor = 'rgba(255,255,255,0.09)';
    if (!d.survive) {
      const idx = rejectSeen; rejectSeen++;
      const start = 0.04 + idx * (0.8 / totalRejects);
      const local = clamp01((rt1 - start) / 0.16);
      opacity = 1 - local;
      showReject = local > 0.04 && local < 0.97;
      if (showReject) borderColor = 'rgba(200,60,60,0.4)';
    } else if (d.ring) {
      const pos = d.ring;
      left = lerp(d.base.left, pos.left, rt2);
      top = lerp(d.base.top, pos.top, rt2);
      opacity = 1 - rt3;
      scale = lerp(1, 0.88, rt2) * (1 - rt3 * 0.3);
      if (d.caution && d.cautionAt !== undefined) {
        const causeBump = Math.max(0, 1 - Math.abs(rt1 - d.cautionAt) / 0.16);
        opacity *= 1 - causeBump * 0.55;
        showReject = causeBump > 0.25;
        borderColor = causeBump > 0.25 ? 'rgba(230,170,50,0.4)' : borderColor;
      }
    }
    const tagStyle = d.survive
      ? { bg: 'rgba(230,170,50,0.16)', border: 'rgba(230,170,50,0.4)', color: '#F5C97A' }
      : { bg: 'rgba(180,40,40,0.16)', border: 'rgba(180,40,40,0.35)', color: '#FF9B9B' };
    return {
      name: d.name, mono: d.mono, kind: d.kind, tag: d.tag, accent: d.accent, floatDur: d.floatDur,
      left, top, opacity, showReject, rejectLabel: d.survive ? d.caution : d.reject,
      tagBg: tagStyle.bg, tagBorder: tagStyle.border, tagColor: tagStyle.color, borderColor,
      transform: `translate(-50%,-50%) scale(${scale.toFixed(2)})`,
    };
  });

  const survivorRing: Record<string, { left: number; top: number }> = {};
  REASON_SOURCES.forEach((d) => { if (d.survive && d.ring) survivorRing[d.name] = d.ring; });
  const reasonConnections = REASON_CONNECTIONS.map((c, i) => {
    const a = survivorRing[c.from];
    const b = c.to === 'CENTER' ? SYNTHESIS_CENTER : survivorRing[c.to];
    const start = i * 0.2;
    const local = clamp01((rt2 - start) / 0.35);
    const dx = b.left - a.left, dy = b.top - a.top;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const bulge = (i % 2 === 0 ? 1 : -1) * Math.min(dist * 0.3, 12);
    const cx = (a.left + b.left) / 2 + nx * bulge;
    const cy = (a.top + b.top) / 2 + ny * bulge;
    const bez = (t: number) => ({
      x: (1 - t) * (1 - t) * a.left + 2 * (1 - t) * t * cx + t * t * b.left,
      y: (1 - t) * (1 - t) * a.top + 2 * (1 - t) * t * cy + t * t * b.top,
    });
    const particlePos = bez(local);
    const labelPos = bez(0.82);
    const fadeOut = 1 - rt3;
    const pathOpacity = Math.min(local * 4, 1) * fadeOut;
    const particleOpacity = (local > 0.02 && local < 0.99 ? 1 : 0) * fadeOut;
    const arrival = start + 0.35;
    const decay = clamp01((rt2 - arrival) / 0.3);
    const labelOpacity = (local >= 0.9 ? 1 : 0) * lerp(1, 0.3, decay) * fadeOut;
    return {
      pathD: `M ${a.left},${a.top} Q ${cx},${cy} ${b.left},${b.top}`,
      pathOpacity, particleOpacity, labelOpacity,
      particleLeft: particlePos.x, particleTop: particlePos.y,
      midLeft: labelPos.x, midTop: labelPos.y,
      label: c.label, color: c.color,
    };
  });
  const convergenceOpacity = clamp01((rt2 - 0.2) / 0.6) * (1 - rt4 * 0.7);

  const capSlice = 1 / REASON_CAPTIONS.length;
  const rt12 = clamp01((rpct - RB0) / (RB2 - RB0));
  let bestCapIdx = 0, bestCapBump = 0;
  REASON_CAPTIONS.forEach((_, i) => {
    const center = (i + 0.5) * capSlice;
    const bump = Math.max(0, 1 - Math.abs(rt12 - center) / (capSlice * 0.6));
    if (bump > bestCapBump) { bestCapBump = bump; bestCapIdx = i; }
  });
  const reasonCaptionText = REASON_CAPTIONS[bestCapIdx];
  const reasonCaptionOpacity = reasonStageIndex <= 2 && rt12 > 0 && rt12 < 1 ? clamp01(bestCapBump) : 0;

  const reasonInsightOpacity = rt3;
  const revealCount = Math.floor(rt3 * REASON_INSIGHT_WORDS.length + 0.0001);
  const reasonInsightWords = REASON_INSIGHT_WORDS.map((w, i) => ({ text: w, opacity: i < revealCount ? 1 : 0.12 }));
  const reasonInsightTransform = `translate(-50%, ${lerp(-50, -172, rt4).toFixed(1)}%) scale(${lerp(1, 0.76, rt4).toFixed(2)})`;

  const reasonOutcomes = REASON_OUTCOMES.map((o, i) => {
    const start = i * 0.15;
    const local = clamp01((rt4 - start) / 0.2);
    return { name: o.name, mono: o.mono, accent: o.accent, preview: o.preview, opacity: local, transform: `translateY(${lerp(14, 0, local).toFixed(1)}px)` };
  });
  const reasonStatsOpacity = clamp01((rt4 - 0.62) / 0.2);
  const reasonClosingOpacity = clamp01((rt4 - 0.82) / 0.16);
  const reasonStageLabel = REASON_STAGE_COPY[reasonStageIndex];
  const reasonSteps = REASON_STAGE_COPY.map((label, i) => {
    const active = i === reasonStageIndex;
    const passed = i < reasonStageIndex;
    return {
      num: i + 1, label,
      badgeBg: active ? 'rgba(9,76,178,0.28)' : passed ? 'rgba(9,76,178,0.12)' : 'transparent',
      badgeColor: active ? 'var(--pale)' : passed ? 'var(--bright)' : 'var(--text-muted)',
      badgeBorder: active ? 'rgba(9,76,178,0.55)' : 'var(--border-subtle)',
      textColor: active ? 'var(--text-primary)' : 'var(--text-muted)',
      opacity: active ? 1 : passed ? 0.6 : 0.42,
    };
  });

  // ---- Capture / collection visualization (ambient looping) ----
  const captureLaneIdx = s.captureTick % CAPTURE_ORIGINS.length;
  const captureLoop = Math.floor(s.captureTick / CAPTURE_ORIGINS.length);
  const captureLaneT = clamp01(s.captureSubT);
  const easeOutExpoLocal = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const capturePositions = CAPTURE_ORIGINS.map((o, i) => {
    const isActive = i === captureLaneIdx;
    let opacity = 0, left = o.pos.left, top = o.pos.top, scale = 0.7;
    if (isActive) {
      const te = easeOutExpoLocal(Math.min(captureLaneT / 0.8, 1));
      left = lerp(o.pos.left, CAPTURE_CENTER.left, te);
      top = lerp(o.pos.top, CAPTURE_CENTER.top, te);
      scale = lerp(0.82, 1, Math.min(captureLaneT / 0.25, 1)) * (1 - (Math.max(0, captureLaneT - 0.85) / 0.15) * 0.3);
      if (captureLaneT < 0.12) opacity = captureLaneT / 0.12;
      else if (captureLaneT > 0.82) opacity = Math.max(0, 1 - (captureLaneT - 0.82) / 0.18);
      else opacity = 1;
    }
    const itemIdx = Math.floor(captureLoop / CAPTURE_ORIGINS.length) % o.items.length;
    return { key: o.key, left, top, opacity, accent: o.accent, itemLabel: o.items[itemIdx], transform: `translate(-50%,-50%) scale(${scale.toFixed(2)})` };
  });
  const captureOriginsVals = CAPTURE_ORIGINS.map((o, i) => {
    const pulsing = i === captureLaneIdx && captureLaneT < 0.22;
    const pulseT = pulsing ? 1 - captureLaneT / 0.22 : 0;
    return {
      key: o.key, label: o.label, left: o.pos.left, top: o.pos.top, accent: o.accent,
      isApp: o.key === 'app', isExt: o.key === 'ext', isWa: o.key === 'wa', isTg: o.key === 'tg',
      ringOpacity: (pulseT * 0.7).toFixed(2),
      floatDur: 5.4 + i * 0.5 + 's', floatDelay: i * -1.3 + 's',
    };
  });
  const captureCount = 1 + (s.captureTick % 8);
  const captureCountSuffix = captureCount === 1 ? '' : 's';
  const captureFlashOn = captureLaneT > 0.8 && captureLaneT < 1;
  const flashT = captureFlashOn ? 1 - Math.abs(captureLaneT - 0.87) / 0.13 : 0;
  const captureCaseScale = (1 + Math.max(0, flashT) * 0.018).toFixed(3);
  const captureGlowStrength = 0.2 + Math.max(0, flashT) * 0.32;
  const captureCaseShadow = `0 0 ${Math.round(40 + Math.max(0, flashT) * 34)}px rgba(77,130,232,${captureGlowStrength.toFixed(2)})`;
  let captureStatusText = CAPTURE_STATUS_TIERS[0].text;
  for (const tier of CAPTURE_STATUS_TIERS) if (captureCount >= tier.min) captureStatusText = tier.text;

  // ---- Problem section (interval-driven) ----
  const problemShowSources = s.problemPhase === 0 || s.problemPhase === 1;
  const problemSources = THINK_SOURCE_DEFS.map((d, i) => ({
    name: d.name, type: d.type, mono: d.mono, accent: d.accent, floatDur: d.floatDur,
    left: PROBLEM_SOURCE_POS[i].left, top: PROBLEM_SOURCE_POS[i].top,
    opacity: s.problemPhase === 1 ? 0.55 : 1,
  }));
  const problemShowSignals = s.problemPhase === 1;
  const problemShowThesis = s.problemPhase === 2;
  const problemShowOutputs = s.problemPhase === 3;
  const problemOutputs = THINK_OUTPUT_DEFS.map((o, i) => ({ ...o, delay: i * 0.2 + 's' }));
  const problemShowQuestion = s.problemPhase === 4;

  // Kept as a separate object (never merged into `vals`) so the stricter
  // react-hooks/refs lint rule doesn't taint every plain-value access on `vals`
  // across every component that receives it as a prop.
  const refs = {
    setHeroCanvasRef: (el: HTMLCanvasElement | null) => { heroCanvasRef.current = el; },
    setHeroForegroundRef: (el: HTMLElement | null) => { heroForegroundRef.current = el; },
    setCtaCanvasRef: (el: HTMLCanvasElement | null) => { ctaCanvasRef.current = el; },
    setChaosRef: (el: HTMLElement | null) => { chaosRef.current = el; },
    setExampleRef: (el: HTMLElement | null) => { exampleRef.current = el; },
    setFlowRef: (el: HTMLElement | null) => { flowRef.current = el; },
    setReasonRef: (el: HTMLElement | null) => { reasonRef.current = el; },
    setCaptureRef: (el: HTMLElement | null) => { captureRef.current = el; },
  };

  const vals = {
    // load overlay / hero
    loadOverlayOpacity, loadOverlayPointer: (s.loadStage >= 5 ? 'none' : 'auto') as CSSProperties['pointerEvents'],
    logoLoadTransform, logoLoadGlow, skipLoad, contentOpacity, contentScale,
    ambientGlow: `radial-gradient(circle 200px at ${s.mouseX}px ${s.mouseY}px, rgba(9,76,178,0.05), transparent 70%)`,
    navBlur: s.scrolled ? 'blur(20px) saturate(180%)' : 'none',
    navBg: s.scrolled ? 'rgba(7,9,15,0.8)' : 'transparent',
    navBorder: s.scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
    heroLine1, heroLine2, heroLine3, heroSub,
    sourceCards, evidenceLabels, outputCards,
    centerGlowOpacity: s.heroAct >= 2 ? 1 : 0,
    flashOpacity: s.heroAct === 3 ? 0.08 : 0,
    thesisOpacity: s.heroAct >= 3 ? 1 : 0,
    thesisTransform: s.heroAct >= 3 ? 'scale(1)' : 'scale(0.85)',
    thesisPulseAnim: s.heroAct >= 3 ? 'marketing-thesisPulse 2.5s ease-in-out infinite' : 'none',
    thesisText: THESIS_TEXT,
    onHeroTilt, onHeroTiltLeave,

    // problem
    problemShowSources, problemSources, problemShowSignals, problemSignals: PROBLEM_SIGNAL_DEFS,
    problemShowThesis, problemShowOutputs, problemOutputs, problemShowQuestion,

    // product flow
    flowStep: s.flowStep, flowSteps, flowProgressHeight: ((s.flowStep - 1) / 4) * 100 + '%',
    flowIsStep1, flowIsStep2, flowIsStep3, flowIsStep4, flowIsStep5,
    sourceMockups: [
      { name: 'Reuters', domain: 'reuters.com', icon: '📰' },
      { name: 'Gartner.pdf', domain: 'gartner.com', icon: '📄' },
      { name: 'OpenAI Blog', domain: 'openai.com', icon: '🔗' },
      { name: 'Bloomberg', domain: 'bloomberg.com', icon: '📰' },
      { name: 'Cloudflare', domain: 'cloudflare.com', icon: '📄' },
    ],
    outputTabs,

    // watch it think
    reasonStageIndex, reasonStageLabel, reasonSources, reasonConnections,
    reasonShowConnections: reasonStageIndex >= 2, convergenceOpacity,
    reasonCaptionText, reasonCaptionOpacity,
    reasonShowInsight: reasonStageIndex >= 3, reasonInsightOpacity, reasonInsightWords, reasonInsightTransform,
    reasonShowOutcomes: reasonStageIndex === 4, reasonOutcomes,
    reasonStatsOpacity, reasonClosingOpacity, reasonSteps,

    // capture
    capturePositions, captureOrigins: captureOriginsVals, captureCount, captureCountSuffix,
    captureCaseScale, captureCaseShadow, captureStatusText,

    // real example
    exampleSources: [{ name: 'OpenAI' }, { name: 'Google' }, { name: 'Cloudflare' }, { name: 'Reuters' }, { name: 'Gartner' }],
    typedThesis: s.typedThesis, cursorOpacity: s.cursorOn ? 1 : 0,

    // use cases
    useCases: USE_CASE_DEFS,

    // pricing
    pricingHover0, pricingHover1,
    pricingOpacity0: s.pricingHoverIdx === 0 ? 1 : 0,
    pricingOpacity1: s.pricingHoverIdx === 1 ? 1 : 0,
    onFreeEnter: () => setPricingHover(0, true),
    onFreeLeave: () => setPricingHover(0, false),
    onWaitlistEnter: () => setPricingHover(1, true),
    onWaitlistLeave: () => setPricingHover(1, false),

    // faq
    faqItems,

    // demo modal
    demoOpen: s.demoOpen, openDemo, closeDemo,
  };

  return { vals, refs };
}

export type LandingEngine = ReturnType<typeof useLandingEngine>;
export type LandingVals = LandingEngine['vals'];
export type LandingRefs = LandingEngine['refs'];
