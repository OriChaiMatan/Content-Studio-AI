import { Link } from 'react-router-dom';
import type { LandingVals } from '../useLandingEngine';
import { useComingSoonModalStore } from '../../../../stores/comingSoonModalStore';
import { useIsMobile } from '../../../../hooks/useIsMobile';

const FREE_FEATURES = [
  '1 Active Content Case',
  '15 Sources per usage cycle',
  '1 Pipeline run every 7 days',
  '1 AI image every 7 days',
  'LinkedIn',
  'Facebook',
  'Newsletter',
  'Podcast',
  'Full LumAI Thinking Engine',
  'Telegram integration',
  'Chrome Extension',
  'Library',
  'No credit card required',
];

const PRO_FEATURES = [
  'More active content cases',
  'More sources',
  'More pipeline runs',
  'More image generations',
  'Priority processing',
  'Early access to new capabilities',
];

export function Pricing({ vals }: { vals: LandingVals }) {
  const showComingSoon = useComingSoonModalStore(s => s.show);
  const isMobile = useIsMobile(900);

  // Desktop reveals each plan's feature list on hover — hover never fires on
  // a touch device, so the mobile layout shows the full list unconditionally
  // instead of leaving it permanently collapsed and unreachable.
  const freeListStyle = isMobile
    ? { marginTop: 16, display: 'flex' as const, flexDirection: 'column' as const, gap: 10, fontSize: 13, color: 'var(--text-secondary)' }
    : { maxHeight: vals.pricingHover0, opacity: vals.pricingOpacity0, transition: 'max-height 0.3s ease, opacity 0.3s ease', overflow: 'hidden', marginTop: 16, display: 'flex' as const, flexDirection: 'column' as const, gap: 10, fontSize: 13, color: 'var(--text-secondary)' };
  const proListStyle = isMobile
    ? { marginTop: 16, display: 'flex' as const, flexDirection: 'column' as const, gap: 10, fontSize: 13, color: 'var(--text-secondary)' }
    : { maxHeight: vals.pricingHover1, opacity: vals.pricingOpacity1, transition: 'max-height 0.3s ease, opacity 0.3s ease', overflow: 'hidden', marginTop: 16, display: 'flex' as const, flexDirection: 'column' as const, gap: 10, fontSize: 13, color: 'var(--text-secondary)' };

  return (
    <section id="pricing" style={{ background: 'var(--bg-elevated)', padding: isMobile ? '56px 20px' : '100px 40px', textAlign: 'center' }}>
      <h2 style={{ fontSize: isMobile ? 26 : 44, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>Start free.<br />More is on the way.</h2>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); vals.openDemo(e); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: isMobile ? 28 : 40 }}
      >
        Watch the demo →
      </a>
      <div style={{ display: 'flex', gap: isMobile ? 16 : 24, maxWidth: 720, margin: '0 auto', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        <div
          onMouseEnter={vals.onFreeEnter}
          onMouseLeave={vals.onFreeLeave}
          style={{ flex: 1, width: isMobile ? '100%' : undefined, minWidth: isMobile ? undefined : 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: isMobile ? 22 : 28, textAlign: 'left', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}
        >
          <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>FREE</span>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 14 }}>$0 <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/ forever</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>The complete LumAI thinking engine, free to use.</div>
          <Link to="/register" style={{ display: 'block', textAlign: 'center', marginTop: 20, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: isMobile ? 13 : 10, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>Start Free</Link>
          <div style={freeListStyle}>
            {FREE_FEATURES.map(f => <div key={f}>✓ {f}</div>)}
          </div>
        </div>

        <div
          onMouseEnter={vals.onWaitlistEnter}
          onMouseLeave={vals.onWaitlistLeave}
          style={{ flex: 1, width: isMobile ? '100%' : undefined, minWidth: isMobile ? undefined : 260, position: 'relative', border: '1.5px dashed rgba(9,76,178,0.4)', borderRadius: 16, padding: isMobile ? 22 : 28, textAlign: 'left', background: 'linear-gradient(135deg, rgba(9,76,178,0.12) 0%, rgba(9,76,178,0.04) 100%)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}
        >
          <span style={{ background: 'rgba(9,76,178,0.15)', color: 'var(--pale)', borderRadius: 100, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>COMING SOON</span>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14, color: 'var(--pale)' }}>LumAI Pro</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>For users who want to turn research into an ongoing content system.</div>
          <button
            type="button"
            onClick={() => showComingSoon()}
            style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 20, background: '#1E54C8', border: 'none', borderRadius: 10, padding: isMobile ? 13 : 10, fontSize: 14, fontWeight: 700, color: 'white', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Join the Waitlist
          </button>
          <div style={proListStyle}>
            {PRO_FEATURES.map(f => <div key={f}>→ {f}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
