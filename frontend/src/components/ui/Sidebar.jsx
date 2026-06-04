import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/dashboard/databases', label: 'Databases', icon: 'storage' },
  { to: '/dashboard/settings', label: 'Settings', icon: 'settings' },
  { to: '/dashboard/support', label: 'Support', icon: 'help' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/signin');
  }

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?';

  return (
    <aside className="dashboard-sidebar">
      {/* Brand */}
      <div className="dashboard-sidebar__brand">
        <div className="dashboard-sidebar__brand-icon">
          <img src="/logos/loonaris-logo.ico" alt="Loonaris" width={28} height={28} />
        </div>
        <span className="dashboard-sidebar__brand-name">Loonaris</span>
      </div>

      {/* Nav */}
      <nav className="dashboard-sidebar__nav" aria-label="Dashboard sections">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'dashboard-sidebar__link is-active' : 'dashboard-sidebar__link'
            }
          >
            <span className="material-symbols-outlined dashboard-sidebar__link-icon">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user + logout */}
      <div className="dashboard-sidebar__footer">
        <button
          type="button"
          className="dashboard-sidebar__user"
          onClick={() => navigate('/dashboard/settings')}
          title="Go to settings"
        >
          <div className="dashboard-sidebar__avatar">{initials}</div>
          <span className="dashboard-sidebar__username label-md">{user?.username ?? '—'}</span>
        </button>
        <button
          type="button"
          className="dashboard-sidebar__logout"
          onClick={handleLogout}
          title="Sign out"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
