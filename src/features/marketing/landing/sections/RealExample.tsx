import { useEffect, useRef } from 'react';
import type { LandingVals, LandingRefs } from '../useLandingEngine';
import { useIsMobile } from '../../../../hooks/useIsMobile';

export function RealExample({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const exampleLocalRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile(900);
  useEffect(() => {
    refs.setExampleRef(exampleLocalRef.current);
    return () => refs.setExampleRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  if (isMobile) {
    // Vertical stack: source cards, then a downward arrow, then the thesis
    // card with its output tags — instead of a three-part horizontal row.
    return (
      <section ref={exampleLocalRef} style={{ padding: '56px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 32px' }}>See how research becomes a thesis.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {vals.exampleSources.map((es) => (
            <div key={es.name} style={{ width: '100%', maxWidth: 280, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '11px 14px', fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'left' }}>📄 {es.name}</div>
          ))}
        </div>
        <svg width="40" height="40" viewBox="0 0 56 56" style={{ boxShadow: '0 0 32px rgba(9,76,178,0.4)', borderRadius: 12, margin: '18px 0', transform: 'rotate(90deg)' }}>
          <rect width="56" height="56" rx="14" fill="#094CB2" />
          <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="38" cy="18" r="3.5" fill="white" />
        </svg>
        <div style={{ width: '100%', textAlign: 'left' }}>
          <div style={{ background: 'rgba(9,76,178,0.1)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 0 40px rgba(9,76,178,0.2)', minHeight: 100 }}>
            <span style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 16.5, color: 'var(--pale)' }}>{vals.typedThesis}</span>
            <span style={{ opacity: vals.cursorOpacity, fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 16.5, color: 'var(--pale)' }}>|</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>💼 LinkedIn Post</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>👥 Facebook Post</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>✉️ Newsletter</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>🎙️ Podcast Episode</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={exampleLocalRef} style={{ padding: '120px 40px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 44, fontWeight: 700, margin: '0 0 56px' }}>See how research becomes a thesis.</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, maxWidth: 1000, margin: '0 auto', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vals.exampleSources.map((es) => (
            <div key={es.name} style={{ width: 130, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>📄 {es.name}</div>
          ))}
        </div>
        <svg width="48" height="48" viewBox="0 0 56 56" style={{ boxShadow: '0 0 32px rgba(9,76,178,0.4)', borderRadius: 14 }}>
          <rect width="56" height="56" rx="14" fill="#094CB2" />
          <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="38" cy="18" r="3.5" fill="white" />
        </svg>
        <div style={{ maxWidth: 340, textAlign: 'left' }}>
          <div style={{ background: 'rgba(9,76,178,0.1)', border: '1.5px solid rgba(9,76,178,0.4)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 0 40px rgba(9,76,178,0.2)', minHeight: 110 }}>
            <span style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 20, color: 'var(--pale)' }}>{vals.typedThesis}</span>
            <span style={{ opacity: vals.cursorOpacity, fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: 20, color: 'var(--pale)' }}>|</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>💼 LinkedIn Post</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>👥 Facebook Post</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>✉️ Newsletter</span>
            <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>🎙️ Podcast Episode</span>
          </div>
        </div>
      </div>
    </section>
  );
}
