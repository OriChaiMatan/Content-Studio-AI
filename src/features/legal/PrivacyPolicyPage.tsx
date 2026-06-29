import { LumAILogoMark } from '../../components/ui/LumaiLogo';

// Public privacy policy for the LumAI Browser Extension (Chrome Web Store).
// Self-contained page (no auth, no AppLayout) so it renders for logged-out
// reviewers at https://app.mrtrk.com/privacy.

const SUPPORT_EMAIL = 'ori.chaimatan@gmail.com';
const LAST_UPDATED = 'June 29, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-on-surface">{title}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-on-surface-variant space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <LumAILogoMark size={40} className="rounded-xl" />
          <div>
            <div className="text-[18px] font-semibold text-on-surface leading-tight">LumAI</div>
            <div className="text-[13px] text-on-surface-variant">Browser Extension — Privacy Policy</div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm p-7">
          <h1 className="text-[22px] font-semibold text-on-surface">Privacy Policy</h1>
          <p className="mt-1 text-[13px] text-on-surface-variant">Last updated: {LAST_UPDATED}</p>

          <p className="mt-5 text-[14px] leading-relaxed text-on-surface-variant">
            The LumAI Browser Extension lets you save a webpage into your LumAI account.
            This policy explains exactly what the extension collects and how that data is used.
          </p>

          <Section title="What the extension collects">
            <p>
              When — and only when — you click <span className="font-medium text-on-surface">Save</span>, the
              extension reads the <span className="font-medium text-on-surface">current page's URL and title</span>{' '}
              and the case you select. Nothing is collected in the background.
            </p>
          </Section>

          <Section title="Authentication">
            <p>
              The extension uses your <span className="font-medium text-on-surface">existing LumAI login/session</span>{' '}
              to authenticate. It does not ask for, store, or transmit your password, and it does not create a
              separate account.
            </p>
          </Section>

          <Section title="What the extension does NOT do">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>It does <span className="font-medium text-on-surface">not</span> collect your browsing history.</li>
              <li>It does <span className="font-medium text-on-surface">not</span> read full page content in this version — only the page URL and title on Save.</li>
              <li>It does <span className="font-medium text-on-surface">not</span> track you across sites or run in the background.</li>
              <li>It does <span className="font-medium text-on-surface">not</span> sell or share your data with third parties.</li>
            </ul>
          </Section>

          <Section title="Where your data goes">
            <p>
              Saved sources are stored inside <span className="font-medium text-on-surface">your LumAI account</span>,
              alongside the content cases you already create in the LumAI web app. Data is sent to LumAI
              <span className="font-medium text-on-surface"> securely over HTTPS</span>.
            </p>
          </Section>

          <Section title="Permissions">
            <p>
              The extension requests only the minimum Chrome permissions it needs: access to the
              <span className="font-medium text-on-surface"> active tab</span> (to read the current page's URL/title when you click Save)
              and your LumAI <span className="font-medium text-on-surface">session cookie</span> for the LumAI domain (to authenticate the save request).
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or your data? Email{' '}
              <a className="font-medium text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-[12px] text-on-surface-variant">© {new Date().getFullYear()} LumAI</p>
      </div>
    </div>
  );
}
