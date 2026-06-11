import { NavLink, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { Icon } from '../ui/Icon';

const navItems = [
  { to: '/',              icon: 'dashboard',    label: 'Dashboard' },
  { to: '/cases',         icon: 'folder_open',  label: 'Content Cases' },
  { to: '/library',       icon: 'auto_stories', label: 'Library' },
  { to: '/settings',      icon: 'settings',     label: 'Settings' },
];

export function Sidebar() {
  const user = useSettingsStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  return (
    <aside className="h-screen w-72 flex flex-col fixed left-0 top-0 bg-surface-container shadow-sm z-50 p-4 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-4 px-2 py-4">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary">
          <Icon name="auto_stories" />
        </div>
        <div>
          <h1 className="text-[22px] font-serif font-bold text-primary leading-7">Content Studio AI</h1>
          <p className="text-[11px] font-sans text-on-surface-variant tracking-wide">Editorial Content System</p>
        </div>
      </div>

      {/* New Content Case CTA */}
      <button
        onClick={() => navigate('/cases/new')}
        className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl px-6 py-3 font-bold text-sm transition-transform active:scale-95 hover:bg-primary/90"
      >
        <Icon name="add" size="sm" />
        <span>New Content Case</span>
      </button>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 mt-4">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => [
              'flex items-center gap-4 px-4 py-2 rounded-xl text-[14px] font-sans transition-colors',
              isActive
                ? 'bg-secondary-container text-on-secondary-container font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50',
            ].join(' ')}
          >
            <Icon name={item.icon} size="md" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

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
          title="Settings"
        >
          <Icon name="settings" size="sm" />
        </button>
        <button
          onClick={() => { void logout(); }}
          className="text-on-surface-variant hover:text-error transition-colors"
          title="Sign out"
        >
          <Icon name="logout" size="sm" />
        </button>
      </div>
    </aside>
  );
}
