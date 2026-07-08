import type { LandingVals } from '../useLandingEngine';

export function Faq({ vals }: { vals: LandingVals }) {
  return (
    <section id="faq" style={{ background: 'var(--bg-elevated)', padding: '80px 40px' }}>
      <h2 style={{ fontSize: 36, fontWeight: 700, textAlign: 'center', margin: '0 0 40px' }}>Questions worth asking.</h2>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {vals.faqItems.map((faq) => (
          <div key={faq.q} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '20px 0' }}>
            <div onClick={faq.toggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontWeight: 600, fontSize: 17, color: 'var(--text-primary)' }}>{faq.q}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{faq.icon}</span>
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
