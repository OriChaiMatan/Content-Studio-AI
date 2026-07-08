import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useT } from '../../i18n/useT';
import type { StringKey } from '../../i18n/strings';
import { Icon } from '../ui/Icon';
import { LumaiLogoChip } from '../ui/LumaiLogo';

const navItems: { to: string; icon: string; labelKey: StringKey }[] = [
  { to: '/',              icon: 'dashboard',    labelKey: 'nav.dashboard' },
  { to: '/cases',         icon: 'folder_open',  labelKey: 'nav.cases' },
  { to: '/library',       icon: 'auto_stories', labelKey: 'nav.library' },
  { to: '/settings',      icon: 'settings',     labelKey: 'nav.settings' },
];

export function Sidebar() {
  const user = useSettingsStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileNavOpen = useUiStore(s => s.mobileNavOpen);
  const closeMobileNav = useUiStore(s => s.closeMobileNav);
  const { t, dir } = useT();
  // Off-canvas (closed) slides out toward the inline-start edge — left in LTR,
  // right in RTL — so the drawer animation is correct in both directions.
  const closedTransform = dir === 'rtl' ? 'translate-x-full' : '-translate-x-full';

  // Auto-close the mobile drawer on any route change (covers nav clicks, the CTA,
  // footer actions, and browser back/forward). No-op on md+ where it's static.
  useEffect(() => { closeMobileNav(); }, [location.pathname, closeMobileNav]);

  return (
    <aside
      className={[
        'h-screen w-72 flex flex-col fixed start-0 top-0 bg-surface-container shadow-sm z-50 p-4 gap-6',
        // Off-canvas on mobile (slide in when open); always visible from md up.
        'transition-transform duration-200 ease-out md:translate-x-0',
        mobileNavOpen ? 'translate-x-0' : closedTransform,
      ].join(' ')}
    >
      {/* Logo + mobile close */}
      <div className="flex items-center gap-4 px-2 py-4">
        <LumaiLogoChip box={40} />
        <div className="min-w-0">
          <h1 className="text-[22px] font-serif font-bold text-primary leading-7 truncate">LumAI</h1>
        </div>
        <button
          onClick={closeMobileNav}
          className="md:hidden ms-auto w-10 h-10 -me-1 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          aria-label="Close menu"
        >
          <Icon name="close" />
        </button>
      </div>

      {/* New Content Case CTA */}
      <button
        onClick={() => navigate('/cases/new')}
        className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl px-6 py-3 font-bold text-sm transition-transform active:scale-95 hover:bg-primary/90"
      >
        <Icon name="add" size="sm" />
        <span>{t('nav.newCase')}</span>
      </button>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 mt-4">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => [
              'flex items-center gap-4 px-4 py-2.5 rounded-xl text-[14px] font-sans transition-colors',
              isActive
                ? 'bg-secondary-container text-on-secondary-container font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50',
            ].join(' ')}
          >
            <Icon name={item.icon} size="md" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom group: user footer */}
      <div className="flex flex-col gap-3">
        {/* User footer */}
        <div className="border-t border-outline-variant pt-4 flex items-center gap-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0">
            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[14px] font-medium text-on-surface truncate">{user.name}</p>
            <p className="text-[11px] text-on-surface-variant truncate">{user.role}</p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="text-on-surface-variant hover:text-primary transition-colors"
            title={t('nav.settings')}
          >
            <Icon name="settings" size="sm" />
          </button>
          <button
            onClick={() => { void logout(); }}
            className="text-on-surface-variant hover:text-error transition-colors"
            title={t('nav.signOut')}
          >
            <Icon name="logout" size="sm" />
          </button>
        </div>
      </div>
    </aside>
  );
}
