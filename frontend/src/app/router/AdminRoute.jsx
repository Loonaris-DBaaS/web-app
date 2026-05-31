import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Gate for /admin: requires a logged-in user whose account is an admin.
// Not logged in → sign in; logged in but not admin → bounce to the dashboard.
export default function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
