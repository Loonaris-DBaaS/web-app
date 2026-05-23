import { Navigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import DashboardLayout from '../../layouts/DashboardLayout';
import Landing from '../../features/Landing/Landing';
import SignIn from '../../features/SignIn/Signin';
import SignUp from '../../features/SignUp/Signup';
import Test from '../../features/Test/Test';
import Database from '../../features/Dashboard/Database';
import DatabaseDetailPage from '../../features/Dashboard/DatabaseDetailPage';
import SettingsPage from '../../features/Dashboard/SettingsPage';
import Support from '../../features/Dashboard/Support';

const routes = [
  {
    path: '/',
    element: <Landing />,
  },
  {
    path:'/test',
    element:<Test />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard/databases" replace /> },
      { path: 'databases', element: <Database /> },
      { path: 'databases/:databaseId', element: <DatabaseDetailPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'support', element: <Support /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/signin', element: <SignIn /> },
      { path: '/signup', element: <SignUp /> },
    ],
  },
];
export default routes;
