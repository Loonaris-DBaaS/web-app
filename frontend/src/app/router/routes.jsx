import { Navigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import DashboardLayout from '../../layouts/DashboardLayout';
import Database from '../../pages/Dashboard/Database';
import DatabaseDetailPage from '../../pages/Dashboard/DatabaseDetailPage';
import ErrorPage from '../../pages/ErrorPage/ErrorPage';
import SettingsPage from '../../pages/Dashboard/SettingsPage';
import Support from '../../pages/Dashboard/Support';
import Landing from '../../pages/Landing/Landing';
import SignIn from '../../pages/SignIn/Signin';
import SignUp from '../../pages/SignUp/Signup';
import Test from '../../pages/Test/Test';
import Admin from '../../pages/Admin/Admin';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';

// The admin route path uses the same secret slug as the backend API so that
// the admin page isn't discoverable at a predictable /admin URL.
const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'console-x7k9m2';

const routes = [
  { path: '/', element: <Landing />, errorElement: <ErrorPage /> },
  { path: '/test', element: <Test />, errorElement: <ErrorPage /> },
  { path: `/${ADMIN_SLUG}`, element: <Admin />, errorElement: <ErrorPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Navigate to="/dashboard/databases" replace /> },
          { path: 'databases', element: <Database /> },
          { path: 'databases/:databaseId', element: <DatabaseDetailPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'support', element: <Support /> },
        ],
      },
    ],
  },
  {
    element: <GuestRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/signin', element: <SignIn /> },
          { path: '/signup', element: <SignUp /> },
        ],
      },
    ],
  },
];

export default routes;
