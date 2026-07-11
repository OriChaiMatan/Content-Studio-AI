import { useEffect, useRef } from 'react';
import type { LandingVals, LandingRefs } from '../useLandingEngine';
import { useIsMobile } from '../../../../hooks/useIsMobile';

export function ProductFlow({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const flowLocalRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile(900);
  useEffect(() => {
    refs.setFlowRef(flowLocalRef.current);
    return () => refs.setFlowRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  const mockup = (
    <>
      {vals.flowIsStep1 && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 15 : 18 }}>AI and the Knowledge Economy</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Case · Created July 3</div>
            </div>
            <span style={{ background: 'rgba(77,130,232,0.6)', color: '#07090F', borderRadius: 100, padding: '5px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '13px 16px', color: 'var(--text-muted)', fontSize: 14, margin: '20px 0 18px' }}>
            <span style={{ opacity: 0.7 }}>🔗</span><span>Paste a link or upload a file</span>
            <span style={{ marginLeft: 'auto', background: 'rgba(9,76,178,0.15)', color: 'var(--pale)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>+ Add</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>5 sources added</div>
          {vals.sourceMockups.map((s) => (
            <div key={s.name} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '13px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(9,76,178,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.domain}</div>
              </div>
              <span style={{ fontSize: 11, color: '#5EE38A', background: 'rgba(40,200,80,0.1)', borderRadius: 100, padding: '3px 10px', flexShrink: 0 }}>Indexed</span>
            </div>
          ))}
        </div>
      )}

      {vals.flowIsStep2 && (
        <div style={{ width: '100%', border: '1px solid rgba(9,76,178,0.3)', background: 'rgba(9,76,178,0.08)', borderRadius: 12, padding: isMobile ? 18 : 24 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#094CB2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, animation: 'marketing-spin 2s linear infinite', flexShrink: 0 }}>🔍</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>Research</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Analyzing sources</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>✓ Reading source content</span><span style={{ color: '#5EE38A' }}>Completed</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>✓ Identifying primary claims</span><span style={{ color: '#5EE38A' }}>Completed</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>◐ Mapping contradictions</span><span style={{ color: '#4D82E8' }}>In Progress</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}><span>○ Forming thesis</span><span>Pending</span></div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'linear-gradient(to right,#094CB2,#4D82E8)' }} />
          </div>
        </div>
      )}

      {vals.flowIsStep3 && (
        <div style={{ width: '100%', background: 'rgba(9,76,178,0.1)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 16, padding: isMobile ? '22px 20px' : '28px 32px', boxShadow: '0 0 60px rgba(9,76,178,0.25)', animation: 'marketing-thesisPulse 2.5s ease-in-out infinite' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>Thesis Detected</div>
          <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: isMobile ? 17 : 22, color: '#B1C5FF', lineHeight: 1.6 }}>
            &ldquo;AI does not just change search. It changes who pays for knowledge — and the incentives that keep it accurate.&rdquo;
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 100, padding: '4px 10px' }}>✓ Reuters — confirmed</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 100, padding: '4px 10px' }}>✓ Gartner — consistent</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#5EE38A', fontWeight: 500 }}>✓ Grounded in 5 independent sources</div>
        </div>
      )}

      {vals.flowIsStep4 && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', overflowX: isMobile ? 'auto' : 'visible' }}>
            {vals.outputTabs.map((t) => (
              <span key={t.name} style={{ fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: '8px 8px 0 0', background: t.bg, color: t.color, position: 'relative', top: 1, borderBottom: t.underline, whiteSpace: 'nowrap' }}>{t.name}</span>
            ))}
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: isMobile ? '18px 16px' : '22px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(96,104,128,0.4)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>LumAI Research</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Now</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.4, marginBottom: 10 }}>AI didn&apos;t just change search. It changed who pays for knowledge.</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxHeight: 110, overflow: 'hidden', position: 'relative' }}>
              The feedback loop that funded independent journalism for two decades is quietly breaking. AI-powered search answers the question before the click ever happens — and without the click, the economics that fund the source degrade.
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, background: 'linear-gradient(to bottom, transparent, var(--bg-elevated))' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>👍 847</span><span>💬 23</span><span>↗ 41</span>
            </div>
          </div>
        </div>
      )}

      {vals.flowIsStep5 && (
        <div style={{ width: '100%', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: isMobile ? '100%' : 260, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: isMobile ? '18px 16px' : '22px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>LinkedIn Post · Draft 1</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
              AI didn&apos;t just change search. <span style={{ background: 'rgba(9,76,178,0.22)', borderRadius: 2, color: 'var(--text-primary)', boxShadow: '0 0 0 1px rgba(9,76,178,0.3)' }}>It changed who pays for knowledge.</span> The feedback loop that funded independent journalism for two decades is quietly breaking — and most publishers haven&apos;t noticed yet.
            </div>
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 160px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#1E54C8', color: 'white', textAlign: 'center', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 16px rgba(30,84,200,0.35)' }}>✓ Approve</div>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: 11, fontSize: 13, color: 'var(--text-secondary)', borderBottom: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRight: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>↻ Regenerate</div>
              <div style={{ flex: 1, textAlign: 'center', padding: 11, fontSize: 13, color: '#FF8A8A' }}>✕ Reject</div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isMobile) {
    // Vertical mobile journey: a compact numbered progress tracker up top
    // (instead of a wide vertical step-list sharing row space with the
    // preview) followed by a single full-width mockup card for whichever
    // step is currently active — same scroll-driven progression as desktop.
    return (
      <section id="how" ref={flowLocalRef} style={{ position: 'relative', height: '220vh' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', padding: '72px 20px 32px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', margin: '0 0 24px' }}>From sources to authority in one research run.</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            {vals.flowSteps.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: step.dotBg, border: `2px solid ${step.dotBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: step.textColor }}>{i + 1}</div>
                {i < 4 && <div style={{ flex: 1, height: 2, background: vals.flowStep > i + 1 ? '#4D82E8' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s ease' }} />}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: 'var(--pale)', marginBottom: 20 }}>
            Step {vals.flowStep} of 5 — {vals.flowSteps[vals.flowStep - 1]?.label}
          </div>

          <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, position: 'relative', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            {mockup}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="how" ref={flowLocalRef} style={{ position: 'relative', height: '220vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', padding: '80px 40px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, textAlign: 'center', margin: '0 0 40px' }}>From sources to authority in one research run.</h2>
        <div style={{ display: 'flex', gap: 56, flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', left: 9, top: 10, width: 2, background: '#4D82E8', transition: 'height 0.3s ease', height: vals.flowProgressHeight }} />
            {vals.flowSteps.map((step) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: step.dotBg, border: `2px solid ${step.dotBorder}` }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: step.textColor }}>{step.label}</span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 320, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: 32, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {vals.flowIsStep1 && (
              <div style={{ width: '100%', maxWidth: 520 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>AI and the Knowledge Economy</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Case · Created July 3</div>
                  </div>
                  <span style={{ background: 'rgba(77,130,232,0.6)', color: '#07090F', borderRadius: 100, padding: '5px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '13px 16px', color: 'var(--text-muted)', fontSize: 14, margin: '20px 0 18px' }}>
                  <span style={{ opacity: 0.7 }}>🔗</span><span>Paste a link or upload a file</span>
                  <span style={{ marginLeft: 'auto', background: 'rgba(9,76,178,0.15)', color: 'var(--pale)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>+ Add</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>5 sources added</div>
                {vals.sourceMockups.map((s) => (
                  <div key={s.name} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '13px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(9,76,178,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.domain}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#5EE38A', background: 'rgba(40,200,80,0.1)', borderRadius: 100, padding: '3px 10px', flexShrink: 0 }}>Indexed</span>
                  </div>
                ))}
              </div>
            )}

            {vals.flowIsStep2 && (
              <div style={{ width: '100%', maxWidth: 480, border: '1px solid rgba(9,76,178,0.3)', background: 'rgba(9,76,178,0.08)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#094CB2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, animation: 'marketing-spin 2s linear infinite' }}>🔍</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 18 }}>Research</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Analyzing sources</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>✓ Reading source content</span><span style={{ color: '#5EE38A' }}>Completed</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>✓ Identifying primary claims</span><span style={{ color: '#5EE38A' }}>Completed</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>◐ Mapping contradictions</span><span style={{ color: '#4D82E8' }}>In Progress</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}><span>○ Forming thesis</span><span>Pending</span></div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: 'linear-gradient(to right,#094CB2,#4D82E8)' }} />
                </div>
              </div>
            )}

            {vals.flowIsStep3 && (
              <div style={{ width: '100%', maxWidth: 480 }}>
                <div style={{ width: 480, maxWidth: '100%', background: 'rgba(9,76,178,0.1)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 16, padding: '28px 32px', boxShadow: '0 0 60px rgba(9,76,178,0.25)', animation: 'marketing-thesisPulse 2.5s ease-in-out infinite' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>Thesis Detected</div>
                  <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 22, color: '#B1C5FF', lineHeight: 1.6 }}>
                    &ldquo;AI does not just change search. It changes who pays for knowledge — and the incentives that keep it accurate.&rdquo;
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 100, padding: '4px 10px' }}>✓ Reuters — confirmed</span>
                    <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 100, padding: '4px 10px' }}>✓ Gartner — consistent</span>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13, color: '#5EE38A', fontWeight: 500 }}>✓ Grounded in 5 independent sources</div>
                </div>
              </div>
            )}

            {vals.flowIsStep4 && (
              <div style={{ width: '100%', maxWidth: 560 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
                  {vals.outputTabs.map((t) => (
                    <span key={t.name} style={{ fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: '8px 8px 0 0', background: t.bg, color: t.color, position: 'relative', top: 1, borderBottom: t.underline }}>{t.name}</span>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(96,104,128,0.4)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>LumAI Research</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Now</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.4, marginBottom: 10 }}>AI didn&apos;t just change search. It changed who pays for knowledge.</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxHeight: 110, overflow: 'hidden', position: 'relative' }}>
                    The feedback loop that funded independent journalism for two decades is quietly breaking. AI-powered search answers the question before the click ever happens — and without the click, the economics that fund the source degrade.
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, background: 'linear-gradient(to bottom, transparent, var(--bg-elevated))' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>👍 847</span><span>💬 23</span><span>↗ 41</span>
                  </div>
                </div>
              </div>
            )}

            {vals.flowIsStep5 && (
              <div style={{ width: '100%', maxWidth: 600, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '22px 24px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>LinkedIn Post · Draft 1</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                    AI didn&apos;t just change search. <span style={{ background: 'rgba(9,76,178,0.22)', borderRadius: 2, color: 'var(--text-primary)', boxShadow: '0 0 0 1px rgba(9,76,178,0.3)' }}>It changed who pays for knowledge.</span> The feedback loop that funded independent journalism for two decades is quietly breaking — and most publishers haven&apos;t noticed yet.
                  </div>
                </div>
                <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#1E54C8', color: 'white', textAlign: 'center', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 16px rgba(30,84,200,0.35)' }}>✓ Approve</div>
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ textAlign: 'center', padding: 11, fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>↻ Regenerate</div>
                    <div style={{ textAlign: 'center', padding: 11, fontSize: 13, color: '#FF8A8A' }}>✕ Reject</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
