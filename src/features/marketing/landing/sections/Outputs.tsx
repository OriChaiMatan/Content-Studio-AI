const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease, border-color 0.2s ease' };

export function Outputs() {
  return (
    <section id="outputs" style={{ padding: '100px 40px', textAlign: 'center' }}>
      <h2 data-reveal="1" style={{ ...reveal, fontSize: 44, fontWeight: 700, margin: '0 0 12px' }}>One thesis. Multiple formats.</h2>
      <p data-reveal="1" style={{ ...reveal, fontSize: 18, color: 'var(--text-secondary)', margin: '0 0 48px' }}>Same research. Same argument. Different register.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 1080, margin: '0 auto', textAlign: 'left' }}>
        <div data-reveal="1" style={{ ...reveal, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 0', height: 196, background: '#1B1F2E', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#4D82E8,#094CB2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'white' }}>JK</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Jordan Kade</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Research &amp; Strategy · 2h · 🌐</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>⋯</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.55 }}>
              Everyone is optimizing for reach.<br />The companies compounding an advantage are optimizing for a defensible point of view.<br />
              <span style={{ color: 'var(--text-secondary)' }}>Here&apos;s the pattern across 9 sources this quarter →</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>👍 847</span><span>💬 23</span><span>🔁 12</span><span>↗ Send</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>💼 LINKEDIN POST</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Sharp, argument-first.</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>The post makes a position, not a summary. Designed to stop the scroll.</div>
          </div>
        </div>

        <div data-reveal="1" style={{ ...reveal, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '22px 24px 0', height: 196, background: '#12151F', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
              <span style={{ fontFamily: "'Noto Serif',serif", fontWeight: 700, fontSize: 19, color: 'var(--text-primary)' }}>The Signal</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vol. 47 · Jul 2026</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.35, marginTop: 14 }}>Who pays for knowledge when the click disappears?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span style={{ fontFamily: "'Noto Serif',serif", fontSize: 34, lineHeight: 1, color: 'var(--bright)', float: 'left', marginRight: 6 }}>T</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>he loop that funded independent journalism for two decades is quietly breaking — and most publishers haven&apos;t noticed yet.</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>✉️ NEWSLETTER</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Dense, editorial.</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Full analytical treatment — context, thesis, mechanism, implication.</div>
          </div>
        </div>

        <div data-reveal="1" style={{ ...reveal, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 0', height: 196, background: '#1B1F2E', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#4D82E8,#094CB2)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Marketing Minds</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Public group · 3h</div>
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.55, fontWeight: 600 }}>Why do two credible analysts read the same earnings call and reach opposite conclusions?</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>A structural answer, not a hot take. 🧵</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>😮 156</span><span>💬 44</span><span>↗ Share</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>👥 FACEBOOK POST</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Narrative-driven.</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Opens a question. Draws readers in before making the argument.</div>
          </div>
        </div>

        <div data-reveal="1" style={{ ...reveal, background: 'rgba(9,76,178,0.06)', border: '1.5px solid rgba(9,76,178,0.35)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 32px rgba(9,76,178,0.1)' }}>
          <div style={{ padding: '18px 20px 0', height: 196, background: '#0E1424', overflow: 'hidden', fontFamily: "'Noto Serif',serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: "'Inter',sans-serif" }}>Episode 04 · Script</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>Page 3 / 11</span>
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--pale)', textTransform: 'uppercase', marginTop: 14, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>Segment 2 — Who Pays</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8, fontStyle: 'italic' }}>The search engine has been the primary on-ramp to the web&apos;s knowledge economy for twenty-five years. That loop is quietly breaking.</div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><span style={{ fontSize: 11, color: 'var(--bright)', fontWeight: 600, letterSpacing: '0.05em' }}>🎙️ PODCAST SCRIPT</span></div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Complete expert-style episode.</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Full script, thesis, structure and research notes — written, not recorded.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
