import Landing from '../../pages/Landing/Landing';
import AuthLayout from '../../layouts/AuthLayout';
import SignIn from '../../pages/SignIn/Signin';
import SignUp from '../../pages/SignUp/Signup';
import Test from '../../pages/Test';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import Database from '../../pages/Dashboard/Database';
import SettingsPage from '../../pages/Dashboard/SettingsPage';
import Support from '../../pages/Dashboard/Support';
import DatabaseDetailPage from '../../pages/Dashboard/DatabaseDetailPage';

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
