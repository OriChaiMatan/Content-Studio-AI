import { Link } from 'react-router-dom';

const productLinks = [
  { href: '#how', label: 'How it Works' },
  { href: '#outputs', label: 'Outputs' },
  { href: '#watch-think', label: 'Watch it Think' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '48px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, maxWidth: 1200, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 56 56">
              <rect width="56" height="56" rx="14" fill="#094CB2" />
              <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="38" cy="18" r="3.5" fill="white" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 16 }}>LumAI</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>Turn research into original thinking.</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>© 2026 LumAI</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Product</span>
          {productLinks.map((l) => <a key={l.href} href={l.href} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{l.label}</a>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Company</span>
          <Link to="/about" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>About</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
          <Link to="/contact" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5EE38A', marginTop: 4 }} />
          All systems operational
        </div>
      </div>
    </footer>
  );
}
