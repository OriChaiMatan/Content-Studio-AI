import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

// Shared nav/footer for the small marketing subpages (About, Contact, Terms) —
// mirrors the simple "logo + back to home" chrome shared across those pages
// in the design bundle (distinct from the full scroll-aware landing nav).
export function SubpageChrome({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const isMobile = useIsMobile(900);
  return (
    <div style={{ background: '#0D1121', color: '#E9EBFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 20px' : '0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="14" fill="#094CB2" />
            <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="38" cy="18" r="3.5" fill="white" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#E9EBFF' }}>LumAI</span>
        </Link>
        <Link to="/" style={{ fontSize: 14, color: '#606880', textDecoration: 'none' }}>← Back to home</Link>
      </nav>
      <div style={{ flex: 1, maxWidth: 680, margin: '0 auto', padding: isMobile ? '48px 20px 64px' : '100px 40px 120px', width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#4D82E8', textTransform: 'uppercase', marginBottom: 16 }}>{eyebrow}</div>
        <h1 style={{ fontSize: isMobile ? 28 : 44, fontWeight: 700, lineHeight: 1.2, margin: '0 0 20px' }}>{title}</h1>
        {children}
      </div>
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: isMobile ? '28px 20px' : '32px 40px', textAlign: 'center', fontSize: 12, color: '#606880' }}>© 2026 LumAI</footer>
    </div>
  );
}
