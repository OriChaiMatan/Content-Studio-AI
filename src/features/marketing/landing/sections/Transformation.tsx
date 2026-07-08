const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

const BEFORE = [
  '✕ 20 open tabs, no clear angle',
  '✕ Generic AI summaries with no argument',
  '✕ "What should I even say about this?"',
  '✕ Publishing the same take as everyone else',
  '✕ Content that describes instead of argues',
  '✕ Research that expires before you use it',
];
const AFTER = [
  '✓ One defensible thesis, grounded in your sources',
  '✓ Source-aware analysis with epistemic precision',
  '✓ Platform-ready outputs from a single research run',
  '✓ A distinct position, not a summarized consensus',
  '✓ Content that argues instead of describes',
  '✓ A library that compounds over time',
];

export function Transformation() {
  return (
    <section style={{ padding: '80px 40px', textAlign: 'center' }}>
      <h2 data-reveal="1" style={{ ...reveal, fontSize: 44, fontWeight: 700, margin: '0 0 56px' }}>Before and after LumAI.</h2>
      <div style={{ display: 'flex', maxWidth: 1080, margin: '0 auto', gap: 48, alignItems: 'center', textAlign: 'left', flexWrap: 'wrap' }}>
        <div data-reveal="1" style={{ ...reveal, transform: 'translateX(-16px)', flex: 1, minWidth: 260, background: 'rgba(180,30,30,0.04)', border: '1px solid rgba(180,30,30,0.1)', borderRadius: 16, padding: '32px 36px' }}>
          <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 100 }}>BEFORE</span>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BEFORE.map((line) => <div key={line} style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{line}</div>)}
          </div>
        </div>
        <div style={{ flex: '0 0 40px', height: 40, borderRadius: '50%', background: '#1E54C8', boxShadow: '0 0 16px rgba(30,84,200,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>→</div>
        <div data-reveal="1" style={{ ...reveal, transform: 'translateX(16px)', flex: 1, minWidth: 260, background: 'rgba(9,76,178,0.06)', border: '1.5px solid rgba(9,76,178,0.2)', borderRadius: 16, padding: '32px 36px' }}>
          <span style={{ background: 'rgba(9,76,178,0.12)', border: '1px solid rgba(9,76,178,0.3)', color: '#B1C5FF', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 100 }}>AFTER LUMAI</span>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {AFTER.map((line) => <div key={line} style={{ fontSize: 15, color: 'var(--text-primary)' }}>{line}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
