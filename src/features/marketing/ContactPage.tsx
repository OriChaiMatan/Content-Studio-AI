import { useState } from 'react';
import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';

const SUPPORT_EMAIL = 'ori.chaimatan@gmail.com';

const inputStyle: React.CSSProperties = {
  background: '#141828', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
  padding: '14px 16px', color: '#E9EBFF', fontSize: 14, fontFamily: "'Inter',sans-serif",
};

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('LumAI — Contact')}&body=${body}`;
  };

  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="Contact" title="Talk to us.">
        <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8, marginBottom: 40 }}>
          Questions about LumAI, early access, or working together — we&apos;d like to hear from you.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440 }}>
          <input type="text" required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <input type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <textarea required placeholder="How can we help?" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          <button
            type="submit"
            style={{ background: '#1E54C8', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 16px rgba(30,84,200,0.4)', border: 'none', cursor: 'pointer' }}
          >
            Send Message
          </button>
        </form>
      </SubpageChrome>
    </MarketingLayout>
  );
}
