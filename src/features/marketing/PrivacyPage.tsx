import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';

// Content below is the approved LumAI Browser Extension privacy policy, moved
// verbatim from the old standalone PrivacyPolicyPage into the marketing site's
// dark visual format. Do not replace with placeholder copy — this is the real,
// reviewed policy (still what Chrome Web Store reviewers see at /privacy).

const SUPPORT_EMAIL = 'ori.chaimatan@gmail.com';
const LAST_UPDATED = 'June 29, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#E9EBFF', margin: '0 0 10px' }}>{title}</h2>
      <div style={{ fontSize: 15.5, color: '#A0A8C8', lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="Legal" title="Privacy Policy">
        <p style={{ fontSize: 14, color: '#606880', margin: '0 0 32px' }}>Last updated: {LAST_UPDATED}</p>

        <p style={{ fontSize: 16, color: '#A0A8C8', lineHeight: 1.8 }}>
          The LumAI Browser Extension lets you save a webpage into your LumAI account.
          This policy explains exactly what the extension collects and how that data is used.
        </p>

        <Section title="What the extension collects">
          <p>
            When — and only when — you click <strong style={{ color: '#E9EBFF' }}>Save</strong>, the
            extension reads the <strong style={{ color: '#E9EBFF' }}>current page&apos;s URL and title</strong>{' '}
            and the case you select. Nothing is collected in the background.
          </p>
        </Section>

        <Section title="Authentication">
          <p>
            The extension uses your <strong style={{ color: '#E9EBFF' }}>existing LumAI login/session</strong>{' '}
            to authenticate. It does not ask for, store, or transmit your password, and it does not create a
            separate account.
          </p>
        </Section>

        <Section title="What the extension does NOT do">
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>It does <strong style={{ color: '#E9EBFF' }}>not</strong> collect your browsing history.</li>
            <li>It does <strong style={{ color: '#E9EBFF' }}>not</strong> read full page content in this version — only the page URL and title on Save.</li>
            <li>It does <strong style={{ color: '#E9EBFF' }}>not</strong> track you across sites or run in the background.</li>
            <li>It does <strong style={{ color: '#E9EBFF' }}>not</strong> sell or share your data with third parties.</li>
          </ul>
        </Section>

        <Section title="Where your data goes">
          <p>
            Saved sources are stored inside <strong style={{ color: '#E9EBFF' }}>your LumAI account</strong>,
            alongside the content cases you already create in the LumAI web app. Data is sent to LumAI{' '}
            <strong style={{ color: '#E9EBFF' }}>securely over HTTPS</strong>.
          </p>
        </Section>

        <Section title="Permissions">
          <p>
            The extension requests only the minimum Chrome permissions it needs: access to the{' '}
            <strong style={{ color: '#E9EBFF' }}>active tab</strong> (to read the current page&apos;s URL/title when you click Save)
            and your LumAI <strong style={{ color: '#E9EBFF' }}>session cookie</strong> for the LumAI domain (to authenticate the save request).
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#B1C5FF' }}>{SUPPORT_EMAIL}</a>.
          </p>
        </Section>
      </SubpageChrome>
    </MarketingLayout>
  );
}
