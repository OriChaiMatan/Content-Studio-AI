import { useEffect, useRef } from 'react';
import type { LandingVals, LandingRefs } from '../useLandingEngine';
import { useIsMobile } from '../../../../hooks/useIsMobile';

const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(20px)', transition: 'opacity 0.55s ease, transform 0.55s ease' };

function OriginIcon({ o }: { o: LandingVals['captureOrigins'][number] }) {
  if (o.isApp) return <svg width="24" height="24" viewBox="0 0 56 56"><rect width="56" height="56" rx="14" fill="#094CB2" /><path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (o.isExt) return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2.5V8.6M4.2 17.5L9.4 14.5M19.8 17.5L14.6 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  if (o.isWa) return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12c0 1.83.5 3.53 1.4 4.99L2.6 21.4l4.55-1.27A9.44 9.44 0 0 0 12 21.5c5.25 0 9.5-4.25 9.5-9.5S17.25 2.5 12 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8.7 8.4c.2-.45.5-.4.8-.4.25 0 .45 0 .6.35.2.45.65 1.6.7 1.7.05.15.1.3-.02.5-.55.85-1.1.85-.8 1.35.9 1.5 1.75 2.15 3.1 2.8.25.1.4.1.55-.05.15-.15.6-.7.75-.95.15-.25.3-.2.5-.1.2.05 1.35.65 1.6.75.25.1.4.15.45.25.05.1.05.6-.15 1.15-.2.55-1.15 1.05-1.6 1.1-.4.05-.9.1-1.5-.1-.35-.1-.8-.25-1.35-.5-2.4-1.05-3.95-3.4-4.1-3.6-.15-.2-1.2-1.55-1.2-2.95 0-1.4.75-2.05.95-2.3Z" fill="currentColor" /></svg>;
  if (o.isTg) return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2.7 11.5 20.4 4.6c.8-.3 1.5.2 1.2 1.4l-2.9 13.7c-.2 1-.85 1.25-1.7.8l-4.7-3.5-2.3 2.2c-.25.25-.45.45-.9.45l.3-4.5 8.2-7.4c.35-.3-.1-.5-.55-.2l-10.1 6.4-4.35-1.35c-.95-.3-.95-.95.2-1.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
  return null;
}

export function Capture({ vals, refs }: { vals: LandingVals; refs: LandingRefs }) {
  const captureLocalRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile(900);
  useEffect(() => {
    refs.setCaptureRef(captureLocalRef.current);
    return () => refs.setCaptureRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs object is stable across renders
  }, []);

  if (isMobile) {
    // Dedicated mobile ecosystem: the Research Case card stays the visual
    // center, with the four origins arranged cleanly in a 2x2 grid below it
    // instead of a cross-shaped absolute layout — and the physics-driven
    // flying source chips (tuned for a wide canvas) are dropped rather than
    // forced into a cramped column, per "simplify decorative motion."
    return (
      <section ref={captureLocalRef} style={{ padding: '64px 20px' }}>
        <h2 data-reveal="1" style={{ ...reveal, fontSize: 26, fontWeight: 700, lineHeight: 1.25, margin: '0 0 16px', textAlign: 'center' }}>Capture ideas where they happen.</h2>
        <p data-reveal="1" style={{ ...reveal, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 32px', textAlign: 'center' }}>
          Whether you&apos;re browsing the web, chatting in WhatsApp, sharing links in Telegram or working directly inside LumAI, every source flows into the same research case.
        </p>

        <div style={{ width: '100%', maxWidth: 300, margin: '0 auto' }}>
          <div style={{ width: '100%', background: 'rgba(20,24,40,0.7)', border: '1px solid rgba(77,130,232,0.35)', borderRadius: 20, padding: '26px 22px', textAlign: 'center', boxShadow: vals.captureCaseShadow, animation: 'marketing-orbBreathe 5s ease-in-out infinite', marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Research Case</div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>AI and the Knowledge Economy</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--pale)', fontVariantNumeric: 'tabular-nums' }}>{vals.captureCount}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>source{vals.captureCountSuffix} collected</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--bright)', marginTop: 10, letterSpacing: '0.02em' }}>{vals.captureStatusText}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {vals.captureOrigins.map((o) => (
              <div key={o.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ position: 'relative', width: 46, height: 46 }}>
                  <div style={{ position: 'absolute', inset: -5, borderRadius: 16, border: `1px solid ${o.accent}`, opacity: Number(o.ringOpacity), transition: 'opacity 0.4s ease' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                    <OriginIcon o={o} />
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>{o.label}{o.isWa ? ' (Coming Soon)' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <p data-reveal="1" style={{ ...reveal, fontSize: 15, fontWeight: 600, color: 'var(--pale)', margin: '32px 0 0', textAlign: 'center' }}>
          Stop collecting bookmarks.<br />Start building knowledge.
        </p>
      </section>
    );
  }

  return (
    <section ref={captureLocalRef} style={{ padding: '140px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 64, maxWidth: 1320, margin: '0 auto', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 380px' }}>
          <h2 data-reveal="1" style={{ ...reveal, fontSize: 42, fontWeight: 700, lineHeight: 1.2, margin: '0 0 20px' }}>Capture ideas where they happen.</h2>
          <p data-reveal="1" style={{ ...reveal, fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 24px' }}>
            Whether you&apos;re browsing the web, chatting in WhatsApp, sharing links in Telegram or working directly inside LumAI, every source flows into the same research case.
          </p>
          <p data-reveal="1" style={{ ...reveal, fontSize: 16, fontWeight: 600, color: 'var(--pale)', margin: 0 }}>
            Stop collecting bookmarks.<br />Start building knowledge.
          </p>
        </div>

        <div style={{ flex: 1, position: 'relative', height: 560, maxWidth: 640, minWidth: 320 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 460px 460px at 50% 50%, rgba(9,76,178,0.10) 0%, transparent 70%)' }} />

          {vals.captureOrigins.map((o) => (
            <div key={o.key} style={{ position: 'absolute', left: o.left + '%', top: o.top + '%', transform: 'translate(-50%,-50%)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: `marketing-float ${o.floatDur} ease-in-out infinite`, animationDelay: o.floatDelay }}>
                <div style={{ position: 'relative', width: 52, height: 52 }}>
                  <div style={{ position: 'absolute', inset: -6, borderRadius: 18, border: `1px solid ${o.accent}`, opacity: Number(o.ringOpacity), transition: 'opacity 0.4s ease' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                    <OriginIcon o={o} />
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{o.label}</span>
              </div>
            </div>
          ))}

          {vals.capturePositions.map((c) => (
            <div key={c.key} style={{ position: 'absolute', left: c.left + '%', top: c.top + '%', transform: c.transform, opacity: c.opacity, width: 158, background: 'rgba(20,24,40,0.85)', backdropFilter: 'blur(10px)', border: `1px solid ${c.accent}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 0 18px rgba(77,130,232,0.25)', pointerEvents: 'none', transition: 'left 0.06s linear, top 0.06s linear, transform 0.06s linear, opacity 0.15s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent, boxShadow: `0 0 8px 2px ${c.accent}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.itemLabel}</span>
              </div>
            </div>
          ))}

          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <div style={{ transform: `scale(${vals.captureCaseScale})`, transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease', width: 280, background: 'rgba(20,24,40,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(77,130,232,0.35)', borderRadius: 20, padding: '32px 28px', textAlign: 'center', boxShadow: vals.captureCaseShadow, animation: 'marketing-orbBreathe 5s ease-in-out infinite' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Research Case</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>AI and the Knowledge Economy</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--pale)', fontVariantNumeric: 'tabular-nums', transition: 'opacity 0.2s ease' }}>{vals.captureCount}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>source{vals.captureCountSuffix} collected</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bright)', marginTop: 12, letterSpacing: '0.02em' }}>{vals.captureStatusText}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
