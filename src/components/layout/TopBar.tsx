import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
}

export function TopBar({ title, searchPlaceholder, onSearch, actions }: TopBarProps) {
  const [query, setQuery] = useState('');

  return (
    <header className="flex justify-between items-center w-full px-8 h-16 bg-surface border-b border-outline-variant sticky top-0 z-40">
      <h2 className="text-[32px] font-serif text-on-surface leading-10">{title}</h2>

      <div className="flex items-center gap-6">
        {onSearch && (
          <div className="relative flex items-center bg-surface-container-high rounded-full px-4 py-1.5 w-64">
            <Icon name="search" className="text-on-surface-variant mr-1" size="sm" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
              placeholder={searchPlaceholder ?? 'Search...'}
              dir="auto"
              style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
              className="bg-transparent border-none text-[14px] w-full font-sans placeholder:text-on-surface-variant/60"
            />
          </div>
        )}

        {actions}

        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors" title="Notifications">
            <Icon name="notifications" />
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors" title="Help">
            <Icon name="help_outline" />
          </button>
        </div>
      </div>
    </header>
  );
}
