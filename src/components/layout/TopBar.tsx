import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { useUiStore } from '../../stores/uiStore';

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
}

export function TopBar({ title, searchPlaceholder, onSearch, actions }: TopBarProps) {
  const [query, setQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const openMobileNav = useUiStore(s => s.openMobileNav);

  function handleQuery(value: string) {
    setQuery(value);
    onSearch?.(value);
  }

  return (
    <header className="relative flex justify-between items-center w-full px-4 md:px-8 h-16 bg-surface border-b border-outline-variant sticky top-0 z-40">
      {/* Left — hamburger (mobile) + title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button
          onClick={openMobileNav}
          className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>
        <h2
          className="text-[20px] md:text-[32px] font-serif text-on-surface leading-tight md:leading-10 truncate"
          dir="auto"
        >
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2 md:gap-6 shrink-0">
        {onSearch && (
          <>
            {/* Desktop — full search field */}
            <div className="hidden md:flex relative items-center bg-surface-container-high rounded-full px-4 py-1.5 w-64">
              <Icon name="search" className="text-on-surface-variant mr-1" size="sm" />
              <input
                type="text"
                value={query}
                onChange={e => handleQuery(e.target.value)}
                placeholder={searchPlaceholder ?? 'Search...'}
                dir="auto"
                style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
                className="bg-transparent border-none text-[14px] w-full font-sans placeholder:text-on-surface-variant/60"
              />
            </div>
            {/* Mobile — icon only; toggles a full-width search row below the bar */}
            <button
              onClick={() => setMobileSearchOpen(o => !o)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              aria-label="Search"
            >
              <Icon name={mobileSearchOpen ? 'close' : 'search'} />
            </button>
          </>
        )}

        {actions}

        <div className="flex items-center gap-3 md:gap-4">
          <button className="hidden sm:block text-on-surface-variant hover:text-primary transition-colors" title="Notifications">
            <Icon name="notifications" />
          </button>
          <button className="hidden sm:block text-on-surface-variant hover:text-primary transition-colors" title="Help">
            <Icon name="help_outline" />
          </button>
        </div>
      </div>

      {/* Mobile expandable search row */}
      {onSearch && mobileSearchOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-surface border-b border-outline-variant px-4 py-2">
          <div className="flex items-center bg-surface-container-high rounded-full px-4 py-2">
            <Icon name="search" className="text-on-surface-variant mr-1" size="sm" />
            <input
              type="text"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder={searchPlaceholder ?? 'Search...'}
              dir="auto"
              autoFocus
              style={{ unicodeBidi: 'plaintext', textAlign: 'start' }}
              className="bg-transparent border-none text-[14px] w-full font-sans placeholder:text-on-surface-variant/60"
            />
          </div>
        </div>
      )}
    </header>
  );
}
