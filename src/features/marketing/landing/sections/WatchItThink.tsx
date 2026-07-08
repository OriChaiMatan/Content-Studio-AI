import { useEffect, useRef } from 'react';
import type { LandingVals, LandingRefs } from '../useLandingEngine';

export function WatchItThink({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const reasonLocalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    refs.setReasonRef(reasonLocalRef.current);
    return () => refs.setReasonRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  return (
    <section id="watch-think" ref={reasonLocalRef} style={{ position: 'relative', height: '320vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 56, padding: '0 40px', maxWidth: 1320, margin: '0 auto', width: '100%', minHeight: 0, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 360px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--bright)', textTransform: 'uppercase', marginBottom: 20 }}>{vals.reasonStageLabel}</div>
            <h2 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2, margin: '0 0 18px' }}>Every AI can write.<br />Very few can think.</h2>
            <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>LumAI doesn&apos;t begin by writing. It begins by discovering the single insight hidden inside dozens of conflicting sources.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 36 }}>
              {vals.reasonSteps.map((st) => (
                <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: st.opacity, transition: 'opacity 0.4s ease' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: st.badgeBg, color: st.badgeColor, border: `1px solid ${st.badgeBorder}`, transition: 'all 0.35s ease' }}>{st.num}</div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: st.textColor, transition: 'color 0.35s ease' }}>{st.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', height: 600, maxWidth: 720, minWidth: 320 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 480px 480px at 50% 50%, rgba(9,76,178,0.10) 0%, transparent 70%)' }} />

            <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 260, height: 260, opacity: vals.convergenceOpacity, transition: 'opacity 0.8s ease', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(9,76,178,0.35) 0%, rgba(9,76,178,0.1) 45%, transparent 72%)', animation: 'marketing-orbBreathe 4.2s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, margin: '-7px 0 0 -7px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,210,255,0.95), rgba(77,130,232,0.5))', boxShadow: '0 0 26px 8px rgba(77,130,232,0.5)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, margin: '-7px 0 0 -7px', borderRadius: '50%', border: '1px solid rgba(77,130,232,0.5)', animation: 'marketing-ringExpand 2.6s ease-out infinite' }} />
            </div>

            <div style={{ position: 'absolute', left: '50%', top: '5%', transform: 'translateX(-50%)', fontSize: 11.5, fontFamily: "'Noto Serif',serif", fontStyle: 'italic', color: 'var(--text-muted)', whiteSpace: 'nowrap', opacity: vals.reasonCaptionOpacity, transition: 'opacity 0.5s ease' }}>{vals.reasonCaptionText}</div>

            {vals.reasonShowConnections && (
              <>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  {vals.reasonConnections.map((c) => (
                    <path key={c.label} d={c.pathD} fill="none" stroke={c.color} strokeWidth={0.35} strokeLinecap="round" style={{ opacity: c.pathOpacity, transition: 'opacity 0.4s ease' }} />
                  ))}
                </svg>
                {vals.reasonConnections.map((c) => (
                  <div key={c.label + '-p'} style={{ position: 'absolute', left: c.particleLeft + '%', top: c.particleTop + '%', transform: 'translate(-50%,-50%)', width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 10px 2px ${c.color}`, opacity: c.particleOpacity, transition: 'opacity 0.3s ease, left 0.1s linear, top 0.1s linear' }} />
                ))}
                {vals.reasonConnections.map((c) => (
                  <div key={c.label + '-l'} style={{ position: 'absolute', left: c.midLeft + '%', top: c.midTop + '%', transform: 'translate(-50%,-50%)', fontSize: 10, fontWeight: 700, color: c.color, background: 'rgba(15,18,32,0.72)', border: `1px solid ${c.color}`, borderRadius: 100, padding: '3px 9px', whiteSpace: 'nowrap', opacity: c.labelOpacity, transition: 'opacity 0.7s ease' }}>{c.label}</div>
                ))}
              </>
            )}

            {vals.reasonSources.map((src) => (
              <div key={src.name} style={{ position: 'absolute', left: src.left + '%', top: src.top + '%', transform: src.transform, width: 124, background: 'rgba(20,24,40,0.55)', border: `1px solid ${src.borderColor}`, borderRadius: 11, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, opacity: src.opacity, transition: 'left 1.3s cubic-bezier(0.4,0,0.2,1), top 1.3s cubic-bezier(0.4,0,0.2,1), opacity 0.7s ease, transform 0.7s ease, border-color 0.4s ease', animation: `marketing-float ${src.floatDur} ease-in-out infinite` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', background: src.accent }}>{src.mono}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</div>
                    <div style={{ fontSize: 8.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.kind}</div>
                  </div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.02em', color: src.accent, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px', width: 'fit-content' }}>{src.tag}</div>
                {src.showReject && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: src.tagColor, background: src.tagBg, border: `1px solid ${src.tagBorder}`, borderRadius: 100, padding: '2px 8px', width: 'fit-content' }}>✕ {src.rejectLabel}</div>
                )}
              </div>
            ))}

            {vals.reasonShowInsight && (
              <div style={{ position: 'absolute', left: '50%', top: '44%', transform: vals.reasonInsightTransform, width: 420, maxWidth: '80vw', textAlign: 'center', opacity: vals.reasonInsightOpacity, transition: 'transform 1.1s cubic-bezier(0.4,0,0.2,1), opacity 0.9s ease' }}>
                <div style={{ background: 'rgba(9,76,178,0.1)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 18, padding: '28px 32px', boxShadow: '0 0 70px rgba(9,76,178,0.28)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 13 }}>The Insight</div>
                  <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 20, lineHeight: 1.6, color: 'var(--pale)' }}>
                    {vals.reasonInsightWords.map((w, i) => <span key={i} style={{ opacity: w.opacity, transition: 'opacity 0.4s ease' }}>{w.text} </span>)}
                  </div>
                </div>
              </div>
            )}

            {vals.reasonShowOutcomes && (
              <div style={{ position: 'absolute', left: '50%', bottom: '5%', transform: 'translateX(-50%)', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {vals.reasonOutcomes.map((o) => (
                  <div key={o.name} style={{ width: 148, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '11px 12px', opacity: o.opacity, transform: o.transform, transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', background: o.accent }}>{o.mono}</div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{o.name}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{o.preview}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0 0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(13,17,33,0.7)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-subtle)', borderRadius: 100, padding: '10px 22px', opacity: vals.reasonStatsOpacity, transition: 'opacity 0.6s ease' }}>
            <span>18 Sources</span><span style={{ color: 'var(--text-muted)' }}>→</span><span>6 Survived</span><span style={{ color: 'var(--text-muted)' }}>→</span><span style={{ color: 'var(--pale)' }}>1 Insight</span><span style={{ color: 'var(--text-muted)' }}>→</span><span>4 Outputs</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 520, opacity: vals.reasonClosingOpacity, transition: 'opacity 0.7s ease' }}>
            Other tools generate text. <span style={{ color: 'var(--pale)', fontWeight: 600 }}>LumAI develops original thinking — then turns it into content.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
