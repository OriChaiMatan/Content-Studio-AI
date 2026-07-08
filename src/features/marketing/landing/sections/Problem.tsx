import { useEffect, useRef } from 'react';
import type { LandingVals, LandingRefs } from '../useLandingEngine';

const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

export function Problem({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const chaosLocalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    refs.setChaosRef(chaosLocalRef.current);
    return () => refs.setChaosRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  return (
    <section style={{ position: 'relative', padding: '120px 40px 80px', textAlign: 'center' }}>
      <h2 data-reveal="1" style={{ ...reveal, fontSize: 48, fontWeight: 700, maxWidth: 720, margin: '0 auto', lineHeight: 1.2 }}>
        The bottleneck is not information.<br />It is synthesis.
      </h2>
      <p data-reveal="1" style={{ ...reveal, fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '24px auto 0', lineHeight: 1.85 }}>
        You already have the articles, reports, links and ideas.<br /><br />
        The problem is turning them into a clear point of view.<br /><br />
        Most AI tools can summarize your sources.<br />But summaries do not build authority.<br /><br />
        Authority comes from having a thesis.
      </p>

      <div ref={chaosLocalRef} style={{ position: 'relative', width: 820, maxWidth: '92vw', height: 380, margin: '56px auto 0', background: 'var(--bg-base)', borderRadius: 20, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B6B' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5C242' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5EE38A' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>LumAI — Reasoning Engine</span>
        </div>
        <div style={{ position: 'relative', height: 348 }}>
          {vals.problemShowSources && vals.problemSources.map((src) => (
            <div key={src.name} style={{ position: 'absolute', left: src.left + '%', top: src.top + '%', width: 130, background: 'rgba(255,255,255,0.045)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, opacity: src.opacity, transition: 'opacity 0.6s ease', animation: `marketing-float ${src.floatDur} ease-in-out infinite` }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: src.accent }}>{src.mono}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{src.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{src.type}</div>
              </div>
            </div>
          ))}

          {vals.problemShowSignals && vals.problemSignals.map((sig) => (
            <div key={sig.text} style={{ position: 'absolute', left: sig.left + '%', top: sig.top + '%', fontSize: 11, fontWeight: 600, color: 'var(--pale)', background: 'rgba(9,76,178,0.14)', border: '1px solid rgba(9,76,178,0.3)', borderRadius: 100, padding: '5px 12px', opacity: 0, animation: 'marketing-outlineIn 0.5s ease forwards', animationDelay: sig.delay, whiteSpace: 'nowrap' }}>{sig.text}</div>
          ))}

          {vals.problemShowThesis && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ background: 'rgba(9,76,178,0.12)', border: '1.5px solid rgba(9,76,178,0.45)', borderRadius: 16, padding: '26px 48px', boxShadow: '0 0 60px rgba(9,76,178,0.3)', animation: 'marketing-thesisPulse 2.2s ease-in-out infinite' }}>
                <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontWeight: 700, fontSize: 30, color: 'var(--pale)', letterSpacing: '0.02em' }}>Thesis</div>
              </div>
            </div>
          )}

          {vals.problemShowOutputs && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>One Thesis. Every Format.</div>
              {vals.problemOutputs.map((out) => (
                <div key={out.name} style={{ opacity: 0, animation: 'marketing-outlineIn 0.45s ease forwards', animationDelay: out.delay }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{out.icon} {out.name}</div>
                </div>
              ))}
            </div>
          )}

          {vals.problemShowQuestion && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3,4,10,0.4)' }}>
              <div style={{ background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(8px)', padding: '14px 28px', borderRadius: 10, fontWeight: 600, fontSize: 22, color: 'var(--text-primary)', textAlign: 'center', maxWidth: '80%', opacity: 0, animation: 'marketing-outlineIn 0.5s ease forwards' }}>
                &ldquo;What thesis is hiding inside these sources?&rdquo;
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
