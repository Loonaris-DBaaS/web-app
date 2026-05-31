import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Guest-only routes (sign-in / sign-up). If the user is already authenticated,
// send them to the dashboard home instead of showing the auth pages.
export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
