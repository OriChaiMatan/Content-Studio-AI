import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LandingVals } from './landing/useLandingEngine';
import { useIsMobile } from '../../hooks/useIsMobile';

const NAV_LINKS = [
  { href: '#how', label: 'How it Works' },
  { href: '#outputs', label: 'Outputs' },
  { href: '#watch-think', label: 'Watch it Think' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingNav({ vals }: { vals: LandingVals }) {
  const isMobile = useIsMobile(900);
  const [menuOpen, setMenuOpen] = useState(false);

  // Collapse the mobile menu the instant the layout crosses back to desktop
  // (so it can't be left open, un-closeable via the now-absent hamburger,
  // behind a resize) using React's documented render-time reset pattern
  // instead of an effect — avoids a synchronous setState-in-effect.
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    if (!isMobile) setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  if (!isMobile) {
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

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        backdropFilter: vals.navBlur, background: vals.navBg, borderBottom: vals.navBorder,
        transition: 'all 200ms ease', opacity: vals.contentOpacity,
      }}
    >
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0, flexShrink: 0 }}>
          <svg width="30" height="30" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="14" fill="#094CB2" />
            <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="38" cy="18" r="3.5" fill="white" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 17, marginLeft: 9, color: 'var(--text-primary)' }}>LumAI</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Link to="/register" style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 14, padding: '9px 16px', borderRadius: 10, boxShadow: '0 4px 16px rgba(30,84,200,0.4)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Start Free</Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="marketing-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              width: 40, height: 40, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ display: 'block', width: 17, height: 2, borderRadius: 1, background: 'var(--text-primary)', transition: 'transform 0.2s ease', transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: 17, height: 2, borderRadius: 1, background: 'var(--text-primary)', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s ease' }} />
            <span style={{ display: 'block', width: 17, height: 2, borderRadius: 1, background: 'var(--text-primary)', transition: 'transform 0.2s ease', transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      <div
        id="marketing-mobile-menu"
        role="menu"
        aria-hidden={!menuOpen}
        style={{
          maxHeight: menuOpen ? 460 : 0, opacity: menuOpen ? 1 : 0, overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.25s ease',
          borderTop: menuOpen ? vals.navBorder : 'none', background: '#0B0E1A',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 18px 20px' }}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} role="menuitem" tabIndex={menuOpen ? 0 : -1} onClick={closeMenu} style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', padding: '15px 4px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {l.label}
            </a>
          ))}
          <Link to="/login" role="menuitem" tabIndex={menuOpen ? 0 : -1} onClick={closeMenu} style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', padding: '15px 4px' }}>Sign In</Link>
        </div>
      </div>
    </nav>
  );
}
