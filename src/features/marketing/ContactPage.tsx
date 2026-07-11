import { useState } from 'react';
import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';
import { api, ApiError } from '../../lib/api';
import { useIsMobile } from '../../hooks/useIsMobile';

// Mobile gets a 16px input font (iOS Safari auto-zooms the page on focusing
// any input smaller than that) and a taller touch target — desktop keeps its
// existing 14px/14px padding exactly as approved.
function useInputStyle(isMobile: boolean): React.CSSProperties {
  return {
    background: '#141828', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
    padding: isMobile ? '15px 16px' : '14px 16px', color: '#E9EBFF', fontSize: isMobile ? 16 : 14,
    fontFamily: "'Inter',sans-serif", width: '100%', boxSizing: 'border-box',
  };
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const isMobile = useIsMobile(900);
  const inputStyle = useInputStyle(isMobile);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return; // guards against double-submit (e.g. double-click)
    setStatus('submitting');
    setErrorMessage('');
    try {
      await api.post('/contact', { name, email, message });
      setStatus('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setErrorMessage('Too many messages sent. Please wait a bit and try again.');
      } else if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Something went wrong sending your message. Please try again.');
      }
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <MarketingLayout>
        <SubpageChrome eyebrow="Contact" title="Message sent.">
          <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8 }}>
            Thanks for reaching out — we&apos;ve received your message and will get back to you soon.
          </p>
        </SubpageChrome>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="Contact" title="Talk to us.">
        <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8, marginBottom: 40 }}>
          Questions about LumAI, early access, or working together — we&apos;d like to hear from you.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440 }}>
          <input
            type="text" required placeholder="Your name" value={name}
            onChange={(e) => setName(e.target.value)} disabled={status === 'submitting'} style={inputStyle}
          />
          <input
            type="email" required placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={status === 'submitting'} style={inputStyle}
          />
          <textarea
            required placeholder="How can we help?" rows={4} value={message}
            onChange={(e) => setMessage(e.target.value)} disabled={status === 'submitting'}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {status === 'error' && (
            <p role="alert" style={{ fontSize: 13, color: '#FF9B9B', margin: 0 }}>{errorMessage}</p>
          )}
          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 15, padding: isMobile ? '15px 32px' : '14px 32px',
              borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 16px rgba(30,84,200,0.4)', border: 'none',
              width: isMobile ? '100%' : undefined, cursor: status === 'submitting' ? 'default' : 'pointer', opacity: status === 'submitting' ? 0.7 : 1,
            }}
          >
            {status === 'submitting' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </SubpageChrome>
    </MarketingLayout>
  );
}
