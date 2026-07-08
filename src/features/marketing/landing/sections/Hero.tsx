import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { LandingVals, LandingRefs } from '../useLandingEngine';

export function Hero({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    refs.setHeroCanvasRef(canvasRef.current);
    refs.setHeroForegroundRef(foregroundRef.current);
    return () => { refs.setHeroCanvasRef(null); refs.setHeroForegroundRef(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  return (
    <section
      style={{
        position: 'relative', minHeight: '100vh', padding: '120px 40px 60px', display: 'flex', alignItems: 'center', gap: 48,
        opacity: vals.contentOpacity, transform: vals.contentScale, transition: 'opacity 0.3s ease, transform 0.3s ease',
        background: 'radial-gradient(ellipse 1400px 900px at 65% 45%, rgba(9,76,178,0.07) 0%, transparent 65%)',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
        backgroundSize: '44px 44px, 44px 44px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '0 0 38%', minWidth: 320, zIndex: 2 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(9,76,178,0.12)', border: '1px solid rgba(9,76,178,0.25)', color: 'var(--pale)', padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 24 }}>
          Narrative Intelligence Platform
        </div>
        <div style={{ fontWeight: 700, fontSize: 56, lineHeight: 1.05, color: 'var(--text-primary)', minHeight: 200 }}>
          <div style={{ opacity: vals.heroLine1, transition: 'opacity 0.6s ease' }}>You have the sources.</div>
          <div style={{ opacity: vals.heroLine2, transition: 'opacity 0.6s ease' }}>LumAI finds</div>
          <div style={{ opacity: vals.heroLine3, transition: 'opacity 0.6s ease', fontStyle: 'italic' }}>the thesis.</div>
        </div>
        <p style={{ fontSize: 19, color: 'var(--text-secondary)', maxWidth: 480, lineHeight: 1.7, marginTop: 20, opacity: vals.heroSub, transition: 'opacity 0.6s ease' }}>
          LumAI transforms articles, reports and research into thesis-driven content — from LinkedIn and Facebook posts to newsletters and complete expert-style podcast scripts.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 36, opacity: vals.heroSub, transition: 'opacity 0.6s ease' }}>
          <Link to="/register" style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, boxShadow: '0 4px 16px rgba(30,84,200,0.4)', textDecoration: 'none' }}>Start Free</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); vals.openDemo(e); }} style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, padding: '14px 32px', borderRadius: 12, textDecoration: 'none' }}>Watch the demo →</a>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14, opacity: vals.heroSub }}>No credit card required.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, opacity: vals.heroSub }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4D82E8', animation: 'marketing-float 1.6s ease-in-out infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>847 theses formed today</span>
        </div>
      </div>

      <div
        style={{ flex: 1, minWidth: 320, position: 'relative', height: 640, borderRadius: 24, border: '1px solid var(--border-subtle)', overflow: 'hidden', background: 'var(--bg-elevated)', zIndex: 2 }}
        onMouseMove={vals.onHeroTilt}
        onMouseLeave={vals.onHeroTiltLeave}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }} />
        <div ref={foregroundRef} style={{ position: 'absolute', inset: 0, zIndex: 1, transition: 'transform 0.15s ease-out', transform: 'perspective(1200px) rotateX(0) rotateY(0)' }}>
          {vals.sourceCards.map((card) => (
            <div key={card.name} style={{ position: 'absolute', left: card.x, top: card.y, width: 150, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', opacity: card.opacity, transform: card.transform, transition: 'opacity 0.5s ease, transform 0.5s ease', animation: `marketing-float ${card.floatDur} ease-in-out infinite` }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--text-muted)' }} />{card.name}
              </div>
              <div style={{ height: 6, width: '70%', background: 'rgba(255,255,255,0.35)', borderRadius: 3, marginBottom: 5 }} />
              <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.12)', borderRadius: 2, marginBottom: 4 }} />
              <div style={{ height: 4, width: '60%', background: 'rgba(255,255,255,0.12)', borderRadius: 2 }} />
            </div>
          ))}

          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 160, height: 160, marginLeft: -80, marginTop: -80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(77,130,232,0.18) 0%, transparent 70%)', opacity: vals.centerGlowOpacity, transition: 'opacity 1s ease' }} />

          {vals.evidenceLabels.map((lbl) => (
            <div key={lbl.text} style={{ position: 'absolute', left: lbl.x, top: lbl.y, display: 'flex', alignItems: 'center', gap: 5, opacity: lbl.opacity, transition: 'opacity 0.5s ease' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4D82E8' }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{lbl.text}</span>
            </div>
          ))}

          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 220, height: 170, marginLeft: -110, marginTop: -85, pointerEvents: 'none', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', opacity: vals.flashOpacity, transition: 'opacity 0.4s ease' }} />

          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 230, marginLeft: -115, marginTop: -70, background: 'rgba(9,76,178,0.12)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 14, padding: '16px 18px', opacity: vals.thesisOpacity, transform: vals.thesisTransform, transition: 'opacity 0.6s cubic-bezier(0.34,1.56,0.64,1), transform 0.6s cubic-bezier(0.34,1.56,0.64,1)', animation: vals.thesisPulseAnim }}>
            <div style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 14, color: 'var(--pale)', lineHeight: 1.5 }}>{vals.thesisText}</div>
          </div>

          {vals.outputCards.map((oc) => (
            <div key={oc.name} style={{ position: 'absolute', left: oc.x, top: oc.y, width: 110, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', opacity: oc.opacity, transform: oc.transform, transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{oc.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
