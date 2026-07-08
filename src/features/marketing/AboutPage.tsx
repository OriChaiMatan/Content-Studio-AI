import { MarketingLayout } from './MarketingLayout';
import { SubpageChrome } from './SubpageChrome';

export function AboutPage() {
  return (
    <MarketingLayout>
      <SubpageChrome eyebrow="About" title="Original thinking, at the pace research actually happens.">
        <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8 }}>
          LumAI was built on a simple observation: the bottleneck for people who write, argue, and publish for a living is rarely information. It&apos;s turning scattered sources into a clear point of view.
        </p>
        <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8, marginTop: 20 }}>
          We&apos;re a small team building a narrative intelligence platform — software that reasons across your research to find the thesis, then carries that argument into the formats you actually publish in.
        </p>
        <p style={{ fontSize: 17, color: '#A0A8C8', lineHeight: 1.8, marginTop: 20 }}>
          More about our team and story is coming soon.
        </p>
      </SubpageChrome>
    </MarketingLayout>
  );
}
