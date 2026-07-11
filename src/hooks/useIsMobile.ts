import { useEffect, useState } from 'react';

// matchMedia-based (not resize-based) so it doesn't re-render on every pixel
// of a drag-resize, and reads the correct value on first paint via useState's
// lazy initializer instead of defaulting to false and flashing desktop layout.
export function useIsMobile(breakpoint = 900): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}
