import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { LandingVals, LandingRefs } from '../useLandingEngine';

export function FinalCta({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    refs.setCtaCanvasRef(canvasRef.current);
    return () => refs.setCtaCanvasRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  return (
    <section style={{ position: 'relative', padding: '160px 40px', textAlign: 'center', background: 'radial-gradient(ellipse 900px 700px at 50% 50%, rgba(9,76,178,0.09) 0%, transparent 70%)', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, margin: 0 }}>You already have the research.<br />LumAI finds what it means.</h2>
        <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 20 }}>Turn scattered sources into thesis-driven content,<br />newsletters and podcast episodes.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 44, flexWrap: 'wrap' }}>
          <Link to="/register" style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, boxShadow: '0 4px 16px rgba(30,84,200,0.4)', textDecoration: 'none' }}>Start Free — No credit card required</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); vals.openDemo(e); }} style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, padding: '14px 32px', borderRadius: 12, textDecoration: 'none' }}>Watch the demo →</a>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>No credit card required. Free plan available.</div>
      </div>
    </section>
  );
}
