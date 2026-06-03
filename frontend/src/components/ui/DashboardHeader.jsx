import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import Button from './Button';

function BellIcon() {
  return (
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
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 1 0 4 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="15"
      height="15"
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
  );
}

export default function DashboardHeader({
  pageTitle,
  pageDescription,
  buttonText,
  buttonIcon,
  buttonOnClick,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?';

  async function handleLogout() {
    await logout();
    navigate('/signin');
  }

  return (
    <header className="dash-header">
      {/* Title + description */}
      <div className="dash-header__title-wrap">
        <span className="dash-header__title">{pageTitle}</span>
        {pageDescription && <p className="dash-header__desc">{pageDescription}</p>}
      </div>

      {/* Action button */}
      {buttonText && buttonOnClick && (
        <Button text={buttonText} icon={buttonIcon} onClick={buttonOnClick} />
      )}

      {/* Right: bell + avatar + logout */}
      <div className="dash-header__actions">
        <button className="dash-header__icon-btn" type="button" aria-label="Notifications">
          <BellIcon />
        </button>

        <button
          className="dash-header__avatar"
          type="button"
          onClick={() => navigate('/dashboard/settings')}
          title={user?.username ?? 'Profile'}
          aria-label="Go to settings"
        >
          {user?.photoUrl ? <img src={user.photoUrl} alt={user.username} /> : initials}
        </button>

        <div className="dash-header__divider" />

        <button
          className="dash-header__logout"
          type="button"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogoutIcon />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
