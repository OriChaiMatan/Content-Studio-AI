const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

const DIFFS = ['Contradictions, not consensus', 'Thesis before writing', 'Maps known vs. inferred'];

export function NarrativeIntelligence() {
  return (
    <section style={{ background: 'var(--bg-elevated)', padding: '100px 40px' }}>
      <div style={{ display: 'flex', maxWidth: 1100, margin: '0 auto', gap: 80, flexWrap: 'wrap' }}>
        <div data-reveal="1" style={{ ...reveal, flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--bright)', textTransform: 'uppercase', marginBottom: 16 }}>Why LumAI Is Different</div>
          <h2 style={{ fontSize: 40, fontWeight: 700, margin: '0 0 20px', lineHeight: 1.2 }}>Most AI tools summarize.<br />LumAI builds an argument.</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8 }}>LumAI looks for the mechanism behind the information — not the main themes, but the specific claim that explains why things are the way they are and what follows from it.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 32 }}>
            {DIFFS.map((label) => (
              <div key={label} style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(9,76,178,0.12)', border: '1px solid rgba(9,76,178,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--bright)' }}>◆</div>
                <div style={{ fontWeight: 600, fontSize: 16, paddingTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div data-reveal="1" style={{ ...reveal, flex: 1, minWidth: 300, display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Summary AI</div>
            <div style={{ border: '1px dashed rgba(96,104,128,0.4)', borderRadius: 8, padding: 14, width: 120, margin: '0 auto 20px', fontSize: 11, color: 'var(--text-muted)' }}>Sources</div>
            <div style={{ color: 'var(--text-muted)', margin: '8px 0' }}>↓</div>
            <div style={{ border: '1px dashed rgba(96,104,128,0.4)', borderRadius: 8, padding: 14, width: 120, margin: '20px auto', fontSize: 11, color: 'var(--text-muted)' }}>Bullet Points</div>
            <div style={{ color: 'var(--text-muted)', margin: '8px 0' }}>↓</div>
            <div style={{ border: '1px dashed rgba(96,104,128,0.4)', borderRadius: 8, padding: 14, width: 120, margin: '20px auto 12px', fontSize: 11, color: 'var(--text-muted)' }}>Summary</div>
            <div style={{ color: 'rgba(255,107,107,0.6)', fontSize: 22 }}>✗</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pale)', marginBottom: 16 }}>LumAI</div>
            <div style={{ border: '1px solid rgba(9,76,178,0.3)', background: 'rgba(9,76,178,0.06)', borderRadius: 8, padding: 14, width: 120, margin: '0 auto', fontSize: 11, color: 'var(--pale)' }}>Sources</div>
            <div style={{ color: 'var(--bright)', margin: '6px 0', fontSize: 13 }}>↓</div>
            <div style={{ border: '1px solid rgba(9,76,178,0.2)', background: 'rgba(9,76,178,0.04)', borderRadius: 8, padding: 10, width: 120, margin: '0 auto', fontSize: 10, color: 'var(--text-secondary)' }}>Contradictions</div>
            <div style={{ color: 'var(--bright)', margin: '6px 0', fontSize: 13 }}>↓</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, margin: '8px 0' }}>
              {[0, 1, 2, 3, 4].map((d) => <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4D82E8', animation: 'marketing-float 2s ease-in-out infinite' }} />)}
            </div>
            <div style={{ color: 'var(--bright)', margin: '6px 0', fontSize: 13 }}>↓</div>
            <div style={{ borderRadius: 8, padding: 14, width: 120, margin: '0 auto', fontSize: 11, color: 'var(--pale)', background: 'rgba(9,76,178,0.15)', boxShadow: '0 0 20px rgba(9,76,178,0.4)' }}>Thesis</div>
            <div style={{ color: 'var(--bright)', margin: '6px 0', fontSize: 13 }}>↓</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 16, marginTop: 6 }}>
              <span>💼</span><span>👥</span><span>✉️</span><span>🎙️</span>
            </div>
            <div style={{ color: '#5EE38A', fontSize: 16, marginTop: 6 }}>✓</div>
          </div>
        </div>
      </div>
    </section>
  );
}
