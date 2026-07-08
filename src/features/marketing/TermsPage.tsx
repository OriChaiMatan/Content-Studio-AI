import { Link } from 'react-router-dom';
import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';

export function TermsPage() {
  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="Legal" title="Terms of Service">
        <p style={{ fontSize: 14, color: '#606880', margin: '0 0 40px' }}>Last updated: July 2026</p>
        <p style={{ fontSize: 16, color: '#A0A8C8', lineHeight: 1.8 }}>
          This page will describe the terms that govern your use of LumAI, including acceptable use, account responsibilities, and intellectual property over generated content.
        </p>
        <p style={{ fontSize: 16, color: '#A0A8C8', lineHeight: 1.8, marginTop: 20 }}>
          Our full terms are being finalized. In the meantime, if you have questions, reach out via our{' '}
          <Link to="/contact" style={{ color: '#B1C5FF' }}>contact page</Link>.
        </p>
      </SubpageChrome>
    </MarketingLayout>
  );
}
