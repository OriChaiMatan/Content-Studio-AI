import { useId } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Official LumAI brand mark — Concept 02 / PRISM (final approved logo).
// One incoming signal refracts through a prism into many outputs: the
// source → multi-platform flow made literal. Colors, proportions, and geometry
// are fixed per the approved asset; only the render `size` varies.
//
// The mark is designed for a dark backdrop (its incoming-signal stroke is near
// white), so callers place it inside a dark chip to keep it balanced/visible on
// the app's light surfaces — see `LumaiLogoChip`.
// ─────────────────────────────────────────────────────────────────────────────
export function LumaiLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  // Unique gradient id per instance so multiple logos on one page never collide.
  const gid = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      role="img"
      aria-label="LumAI"
    >
      <defs>
        <linearGradient id={gid} x1="28" y1="18" x2="52" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9FC2FF" />
          <stop offset="1" stopColor="#A87BFF" />
        </linearGradient>
      </defs>
      {/* incoming signal */}
      <path d="M6 40 H30" stroke="#E8EBF2" strokeWidth="3" strokeLinecap="round" />
      {/* prism */}
      <path d="M40 16 L58 58 H22 Z" stroke={`url(#${gid})`} strokeWidth="3.5" strokeLinejoin="round" fill="rgba(120,140,255,0.06)" />
      {/* refracted outputs */}
      <path d="M50 40 L76 28" stroke="#5B9DFF" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 43 L76 41" stroke="#56D6E0" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 46 L76 54" stroke="#A87BFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// The brand mark on its intended dark backdrop, as a rounded chip. `box` is the
// chip's side length; the mark is inset for balanced padding.
export function LumaiLogoChip({ box = 40, className = '' }: { box?: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-[#094CB2] shrink-0 ${className}`}
      style={{ width: box, height: box }}
    >
      <LumaiLogo size={Math.round(box * 0.66)} />
    </div>
  );
}
