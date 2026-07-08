import { Link } from 'react-router-dom';
import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';

const LAST_UPDATED = 'July 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#E9EBFF', margin: '0 0 10px' }}>{title}</h2>
      <div style={{ fontSize: 15.5, color: '#A0A8C8', lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="Legal" title="Terms of Service">
        <p style={{ fontSize: 14, color: '#606880', margin: '0 0 32px' }}>Last updated: {LAST_UPDATED}</p>

        <p style={{ fontSize: 16, color: '#A0A8C8', lineHeight: 1.8 }}>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of LumAI, a narrative
          intelligence platform that transforms research sources into thesis-driven content
          (&quot;Service&quot;), operated by LumAI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an
          account or otherwise using the Service, you agree to these Terms.
        </p>

        <Section title="1. Acceptance of terms">
          <p>
            By accessing or using LumAI, you confirm that you can form a binding contract and that you
            accept these Terms and our{' '}
            <Link to="/privacy" style={{ color: '#B1C5FF' }}>Privacy Policy</Link>. If you do not agree,
            do not use the Service. If you are using LumAI on behalf of an organization, you represent
            that you have authority to bind that organization to these Terms.
          </p>
        </Section>

        <Section title="2. Service description">
          <p>
            LumAI lets you collect research sources (articles, reports, PDFs, links and notes), analyzes
            them to identify a defensible thesis, and generates platform-ready drafts — including
            LinkedIn posts, Facebook posts, newsletters, and podcast episode scripts — for your review
            and approval. Features, formats, and limits may change as the product evolves, and some
            capabilities described on our marketing pages may be released on a rolling basis.
          </p>
        </Section>

        <Section title="3. User accounts">
          <p>
            You must provide accurate information when creating an account and keep your login
            credentials confidential. You are responsible for all activity that occurs under your
            account. Notify us promptly if you suspect unauthorized access. We may suspend or terminate
            accounts that violate these Terms or that we reasonably believe pose a security or legal
            risk to the Service or other users.
          </p>
        </Section>

        <Section title="4. User content and sources">
          <p>
            You retain ownership of the sources you upload or link (&quot;Source Content&quot;) and of the
            outputs LumAI generates from them once approved (&quot;Generated Content&quot;). You grant us a
            limited license to store, process, and analyze your Source Content solely to operate,
            maintain, and improve the Service for you. You are responsible for having the necessary
            rights to submit any Source Content, and for not submitting material that infringes
            third-party rights, contains malware, or is otherwise unlawful.
          </p>
        </Section>

        <Section title="5. AI-generated content disclaimer">
          <p>
            Generated Content is produced by automated systems based on the Source Content you provide.
            It may contain inaccuracies, omissions, or claims that do not fully reflect your sources or
            current events. LumAI is a drafting and reasoning aid, not a substitute for your own
            editorial judgment. You are solely responsible for reviewing, fact-checking, and approving
            any Generated Content before publishing, distributing, or otherwise relying on it.
          </p>
        </Section>

        <Section title="6. No professional advice">
          <p>
            LumAI and any Generated Content are provided for informational and content-creation purposes
            only and do not constitute legal, financial, medical, investment, or other professional
            advice. You should not rely on Generated Content as a substitute for consulting a qualified
            professional before making decisions based on it.
          </p>
        </Section>

        <Section title="7. Acceptable use">
          <p>You agree not to use the Service to:</p>
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Violate any applicable law or the rights of others, including intellectual property or privacy rights;</li>
            <li>Generate or distribute misleading, defamatory, or deliberately false content presented as fact;</li>
            <li>Attempt to reverse-engineer, scrape, or disrupt the Service, or bypass rate limits or security controls;</li>
            <li>Upload malicious code, or content you do not have the right to submit;</li>
            <li>Resell or provide the Service to third parties without our prior written consent.</li>
          </ul>
        </Section>

        <Section title="8. Subscriptions and payment">
          <p>
            LumAI currently offers a free plan. Paid plans, pricing, and billing terms will be published
            on this page and presented for your acceptance before any charge is made. Where paid plans
            apply, fees are billed in advance on a recurring basis, are non-refundable except as required
            by law or as expressly stated at purchase, and may change with advance notice.
          </p>
        </Section>

        <Section title="9. Intellectual property">
          <p>
            The Service, including its software, design, and branding, is owned by LumAI and protected by
            intellectual property laws. Except for the rights expressly granted to you in these Terms,
            we reserve all rights in the Service. Nothing here transfers ownership of our platform or
            technology to you.
          </p>
        </Section>

        <Section title="10. Privacy">
          <p>
            Our collection and use of personal data in connection with the Service is described in our{' '}
            <Link to="/privacy" style={{ color: '#B1C5FF' }}>Privacy Policy</Link>, which forms part of
            these Terms.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>
            To the maximum extent permitted by law, LumAI and its officers, employees, and partners will
            not be liable for any indirect, incidental, special, consequential, or punitive damages, or
            any loss of profits, data, or goodwill, arising from your use of the Service or reliance on
            Generated Content. Our total liability for any claim relating to the Service will not exceed
            the amount you paid us, if any, in the twelve months preceding the claim.
          </p>
        </Section>

        <Section title="12. Changes to these terms">
          <p>
            We may update these Terms from time to time to reflect changes to the Service or for legal
            reasons. We will update the &quot;Last updated&quot; date above and, for material changes, provide
            reasonable notice (such as an in-app notice or email). Continued use of the Service after
            changes take effect constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Reach out via our{' '}
            <Link to="/contact" style={{ color: '#B1C5FF' }}>contact page</Link>.
          </p>
        </Section>
      </SubpageChrome>
    </MarketingLayout>
  );
}
