import { Link } from 'react-router-dom';
import type { LandingVals } from '../useLandingEngine';

export function Pricing({ vals }: { vals: LandingVals }) {
  return (
    <section id="pricing" style={{ background: 'var(--bg-elevated)', padding: '100px 40px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 44, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>Start free.<br />More is on the way.</h2>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); vals.openDemo(e); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 40 }}
      >
        Watch the demo →
      </a>
      <div style={{ display: 'flex', gap: 24, maxWidth: 720, margin: '0 auto', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div
          onMouseEnter={vals.onFreeEnter}
          onMouseLeave={vals.onFreeLeave}
          style={{ flex: 1, minWidth: 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 28, textAlign: 'left', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}
        >
          <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>FREE</span>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 14 }}>$0 <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/ forever</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>Test the thinking engine before you commit.</div>
          <Link to="/register" style={{ display: 'block', textAlign: 'center', marginTop: 20, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>Start Free</Link>
          <div style={{ maxHeight: vals.pricingHover0, opacity: vals.pricingOpacity0, transition: 'max-height 0.3s ease, opacity 0.3s ease', overflow: 'hidden', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>✓ 3 content cases</div><div>✓ 3 sources per case</div><div>✓ LinkedIn, Facebook, Newsletter &amp; Podcast outputs</div><div>✓ Basic review interface</div><div>✓ Full thinking engine access</div><div>✓ No credit card</div>
          </div>
        </div>

        <div
          onMouseEnter={vals.onWaitlistEnter}
          onMouseLeave={vals.onWaitlistLeave}
          style={{ flex: 1, minWidth: 260, position: 'relative', border: '1.5px dashed rgba(9,76,178,0.4)', borderRadius: 16, padding: 28, textAlign: 'left', background: 'linear-gradient(135deg, rgba(9,76,178,0.12) 0%, rgba(9,76,178,0.04) 100%)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}
        >
          <span style={{ background: 'rgba(9,76,178,0.15)', color: 'var(--pale)', borderRadius: 100, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>COMING SOON</span>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14, color: 'var(--pale)' }}>Early Access</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>For research that becomes a system. Higher limits, priority processing, and what&apos;s next.</div>
          <Link to="/register" style={{ display: 'block', textAlign: 'center', marginTop: 20, background: '#1E54C8', borderRadius: 10, padding: 10, fontSize: 14, fontWeight: 700, color: 'white', textDecoration: 'none' }}>Join the Waitlist</Link>
          <div style={{ maxHeight: vals.pricingHover1, opacity: vals.pricingOpacity1, transition: 'max-height 0.3s ease, opacity 0.3s ease', overflow: 'hidden', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>→ Unlimited content cases</div><div>→ More sources per case</div><div>→ Advanced review workflow</div><div>→ Priority support</div><div>→ Upcoming format updates</div>
          </div>
        </div>
      </div>
    </section>
  );
}
