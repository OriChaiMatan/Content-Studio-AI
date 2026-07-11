import { useIsMobile } from '../../../../hooks/useIsMobile';

const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

const TRUST_ITEMS = [
  { icon: '🔎', title: 'Source-aware', body: 'Every claim traces to a source. The system does not fill gaps with confident-sounding speculation — it marks them as inference.' },
  { icon: '💡', title: 'Thesis-driven', body: 'The argument forms before the content is generated. Every paragraph serves the thesis. Nothing is filler.' },
  { icon: '✓', title: 'Uncertainty-aware', body: 'LumAI distinguishes established claims from inference and analytical hypothesis. This honesty is a feature, not a limitation.' },
  { icon: '👤', title: 'Human review built in', body: 'Every output goes through a review interface — approve, reject, iterate. LumAI gives you stronger material to review.' },
];

export function Trust() {
  const isMobile = useIsMobile(900);
  return (
    <section style={{ background: 'var(--bg-elevated)', padding: isMobile ? '56px 20px' : '100px 40px', textAlign: 'center' }}>
      <h2 data-reveal="1" style={{ ...reveal, fontSize: isMobile ? 26 : 44, fontWeight: 700, margin: '0 0 12px' }}>Built for serious thinking.</h2>
      <p data-reveal="1" style={{ ...reveal, fontSize: isMobile ? 15 : 18, color: 'var(--text-secondary)', maxWidth: 560, margin: isMobile ? '0 auto 28px' : '0 auto 48px' }}>LumAI is not trying to replace your judgment. It gives your judgment better material to work with.</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? 14 : 20, maxWidth: 840, margin: '0 auto', textAlign: 'left' }}>
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} data-reveal="1" style={{ ...reveal, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 24 }}>
            <div style={{ color: 'var(--bright)', fontSize: 20, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.body}</div>
          </div>
        ))}
      </div>
      <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)', marginTop: 32 }}>AI still requires review. LumAI gives you stronger material to review.</p>
    </section>
  );
}
