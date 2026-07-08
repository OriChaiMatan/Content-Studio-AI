import { Link } from 'react-router-dom';
import type { LandingVals } from './landing/useLandingEngine';

export function MarketingNav({ vals }: { vals: LandingVals }) {
  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
        backdropFilter: vals.navBlur, background: vals.navBg, borderBottom: vals.navBorder,
        transition: 'all 200ms ease', opacity: vals.contentOpacity,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 56 56">
          <rect width="56" height="56" rx="14" fill="#094CB2" />
          <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="38" cy="18" r="3.5" fill="white" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18, marginLeft: 10, color: 'var(--text-primary)' }}>LumAI</span>
      </div>
      <div style={{ display: 'flex', gap: 32 }} className="marketing-nav-links">
        <a href="#how" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>How it Works</a>
        <a href="#outputs" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>Outputs</a>
        <a href="#watch-think" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>Watch it Think</a>
        <a href="#pricing" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>Pricing</a>
        <a href="#faq" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>FAQ</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/login" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>Sign In</Link>
        <Link to="/register" style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 14, padding: '8px 20px', borderRadius: 10, boxShadow: '0 4px 16px rgba(30,84,200,0.4)', textDecoration: 'none' }}>Start Free</Link>
      </div>
    </nav>
  );
}
