// ─────────────────────────────────────────────────────────────────────────────
// Official LumAI brand mark — the "L + arrow + spark" glyph in LumAI blue
// (#094CB2) on a white rounded card. Self-contained (carries its own background),
// so it reads cleanly on any surface — no dark chip wrapper required.
//
// `LumAILogoMark` is the canonical component. `LumaiLogo` / `LumaiLogoChip` are
// kept as thin aliases so existing call sites (sidebar, auth, dashboard) need no
// changes — the chip IS the mark now.
// ─────────────────────────────────────────────────────────────────────────────
export function LumAILogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="LumAI logo"
    >
      <rect width="128" height="128" rx="28" fill="#FFFFFF" />

      {/* bold rounded "L" corner-bracket */}
      <path
        d="M24 36V104H92"
        stroke="#094CB2"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 4-point spark */}
      <path
        d="M92 10L99 27L112 34L99 41L92 58L85 41L72 34L85 27Z"
        fill="#094CB2"
      />
    </svg>
  );
}

// Back-compat alias: the bare mark.
export function LumaiLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <LumAILogoMark size={size} className={className} />;
}

// Back-compat alias: previously a blue chip wrapping the old mark. The new mark
// carries its own white rounded card, so the chip simply renders the mark at the
// requested box size. `className` (margins/rounding from call sites) passes through.
export function LumaiLogoChip({ box = 40, className = '' }: { box?: number; className?: string }) {
  return <LumAILogoMark size={box} className={`shrink-0 ${className}`} />;
}
