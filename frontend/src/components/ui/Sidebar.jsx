import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/dashboard/databases', label: 'Databases' },
  { to: '/dashboard/settings', label: 'Settings' },
  { to: '/dashboard/support', label: 'Support' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/signin');
  }

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__brand">
        <p className="label-sm">DBAAS PLATFORM</p>
        <h1 className="title-lg">Control Plane</h1>
      </div>

      <nav className="dashboard-sidebar__nav" aria-label="Dashboard sections">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'dashboard-sidebar__link is-active' : 'dashboard-sidebar__link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '1rem 1.5rem' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--outline-variant)',
            background: 'transparent',
            color: 'var(--on-surface-variant)',
            cursor: 'pointer',
            fontSize: 'var(--text-label-lg-size)',
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
