import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useUiStore } from '../../stores/uiStore';
import { QuotaLimitModal } from '../ui/QuotaLimitModal';
import { ActiveCaseLimitModal } from '../ui/ActiveCaseLimitModal';
import { ArchiveConfirmModal } from '../ui/ArchiveConfirmModal';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const mobileNavOpen = useUiStore(s => s.mobileNavOpen);
  const closeMobileNav = useUiStore(s => s.closeMobileNav);

  return (
    <div className="bg-background text-on-background min-h-screen font-sans">
      <Sidebar />

      {/* Mobile drawer backdrop — tap to dismiss. Below the sidebar (z-50), above content. */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <div className="ms-0 md:ms-72 min-h-screen flex flex-col">
        {children}
      </div>

      <QuotaLimitModal />
      <ActiveCaseLimitModal />
      <ArchiveConfirmModal />
    </div>
  );
}
