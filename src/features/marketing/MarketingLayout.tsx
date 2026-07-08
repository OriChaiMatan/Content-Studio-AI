import type { ReactNode } from 'react';
import './marketing.css';

// Scopes the marketing site's dark theme (CSS vars + keyframes defined in
// marketing.css) under a single class so none of it leaks into the app's
// light MD3 theme (src/index.css).
export function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="marketing-root">{children}</div>;
}
