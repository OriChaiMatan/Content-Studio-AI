import { useIsMobile } from '../../../../hooks/useIsMobile';

export function Interstitial() {
  const isMobile = useIsMobile(900);
  return (
    <section style={{ padding: isMobile ? '56px 24px' : '80px 40px', textAlign: 'center' }}>
      <div data-reveal="1" style={{ opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' }}>
        <div style={{ width: isMobile ? 100 : 200, height: 1, background: 'rgba(255,255,255,0.06)', margin: isMobile ? '0 auto 28px' : '0 auto 40px' }} />
        <p style={{ fontFamily: "'Noto Serif',serif", fontStyle: 'italic', fontSize: isMobile ? 24 : 38, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', lineHeight: 1.5 }}>
          &ldquo;Research without a thesis is just reading.&rdquo;
        </p>
        <div style={{ width: isMobile ? 100 : 200, height: 1, background: 'rgba(255,255,255,0.06)', margin: isMobile ? '28px auto 0' : '40px auto 0' }} />
      </div>
    </section>
  );
}
