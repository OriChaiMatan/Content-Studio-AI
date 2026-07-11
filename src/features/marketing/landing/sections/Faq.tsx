import type { LandingVals } from '../useLandingEngine';
import { useIsMobile } from '../../../../hooks/useIsMobile';

export function Faq({ vals }: { vals: LandingVals }) {
  const isMobile = useIsMobile(900);
  return (
    <section id="faq" style={{ background: 'var(--bg-elevated)', padding: isMobile ? '56px 20px' : '80px 40px' }}>
      <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, textAlign: 'center', margin: isMobile ? '0 0 28px' : '0 0 40px' }}>Questions worth asking.</h2>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {vals.faqItems.map((faq) => (
          <div key={faq.q} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '20px 0' }}>
            <div onClick={faq.toggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: isMobile ? 15.5 : 17, color: 'var(--text-primary)' }}>{faq.q}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>{faq.icon}</span>
            </div>
            {faq.isOpen && (
              <div style={{ borderLeft: '4px solid', borderImage: `linear-gradient(to bottom, #094CB2 0%, #094CB2 ${faq.fill}, transparent ${faq.fill}) 1`, paddingLeft: 20, marginTop: 12, transition: 'border-image 400ms ease' }}>
                <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{faq.a}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
