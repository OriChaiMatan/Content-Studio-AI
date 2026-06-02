import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="bg-background text-on-background min-h-screen font-sans">
      <Sidebar />
      <div className="ml-72 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
