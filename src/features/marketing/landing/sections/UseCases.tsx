import type { LandingVals } from '../useLandingEngine';
import { useIsMobile } from '../../../../hooks/useIsMobile';

const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

export function UseCases({ vals }: { vals: LandingVals }) {
  const isMobile = useIsMobile(900);
  return (
    <section style={{ padding: isMobile ? '56px 20px' : '100px 40px', textAlign: 'center' }}>
      <h2 data-reveal="1" style={{ ...reveal, fontSize: isMobile ? 26 : 44, fontWeight: 700, margin: isMobile ? '0 0 28px' : '0 0 48px' }}>Built for people who think in public.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? 12 : 16, maxWidth: 1200, margin: '0 auto', textAlign: 'left' }}>
        {vals.useCases.map((uc) => (
          <div key={uc.title} data-reveal="1" style={{ ...reveal, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ color: 'var(--bright)', fontSize: 20, marginBottom: 10 }}>{uc.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{uc.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{uc.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
