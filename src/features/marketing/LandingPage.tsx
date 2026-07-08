import { MarketingLayout } from './MarketingLayout';
import { MarketingNav } from './MarketingNav';
import { MarketingFooter } from './MarketingFooter';
import { InteractiveProductDemo } from './InteractiveProductDemo';
import { useLandingEngine } from './landing/useLandingEngine';
import { Hero } from './landing/sections/Hero';
import { Problem } from './landing/sections/Problem';
import { Interstitial } from './landing/sections/Interstitial';
import { Transformation } from './landing/sections/Transformation';
import { ProductFlow } from './landing/sections/ProductFlow';
import { NarrativeIntelligence } from './landing/sections/NarrativeIntelligence';
import { Outputs } from './landing/sections/Outputs';
import { WatchItThink } from './landing/sections/WatchItThink';
import { Capture } from './landing/sections/Capture';
import { RealExample } from './landing/sections/RealExample';
import { Trust } from './landing/sections/Trust';
import { UseCases } from './landing/sections/UseCases';
import { Pricing } from './landing/sections/Pricing';
import { FinalCta } from './landing/sections/FinalCta';
import { Faq } from './landing/sections/Faq';

export function LandingPage() {
  const { vals, refs } = useLandingEngine();

  return (
    <MarketingLayout>
      <div style={{ position: 'relative' }}>
        {/* Load overlay */}
        <div
          onClick={vals.skipLoad}
          style={{
            position: 'fixed', inset: 0, zIndex: 999, background: '#07090F', display: 'flex',
            alignItems: 'center', justifyContent: 'center', opacity: vals.loadOverlayOpacity,
            pointerEvents: vals.loadOverlayPointer, transition: 'opacity 0.4s ease',
          }}
        >
          <svg
            width={48} height={48} viewBox="0 0 56 56"
            style={{ transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease', transform: vals.logoLoadTransform, boxShadow: vals.logoLoadGlow, borderRadius: 14 }}
          >
            <rect width="56" height="56" rx="14" fill="#094CB2" />
            <path d="M18 16 L18 38 L34 38" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="38" cy="18" r="3.5" fill="white" />
          </svg>
        </div>

        {/* Ambient cursor glow */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', background: vals.ambientGlow }} />

        <MarketingNav vals={vals} />

        <Hero vals={vals} refs={refs} />
        <Problem vals={vals} refs={refs} />
        <Interstitial />
        <Transformation />
        <ProductFlow vals={vals} refs={refs} />
        <NarrativeIntelligence />
        <Outputs />
        <WatchItThink vals={vals} refs={refs} />
        <Capture vals={vals} refs={refs} />
        <RealExample vals={vals} refs={refs} />
        <Trust />
        <UseCases vals={vals} />
        <Pricing vals={vals} />
        <FinalCta vals={vals} refs={refs} />
        <Faq vals={vals} />

        <MarketingFooter />

        <InteractiveProductDemo open={vals.demoOpen} onClose={vals.closeDemo} />
      </div>
    </MarketingLayout>
  );
}
