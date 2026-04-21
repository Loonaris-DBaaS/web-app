import Landing from '../../pages/Landing/Landing';
import AuthLayout from '../../layouts/AuthLayout';
import SignIn from '../../pages/SignIn/Signin';
import SignUp from '../../pages/SignUp/Signup';
import Test from '../../pages/Test';
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
    element: <AuthLayout />,
    children: [
      { path: '/signin', element: <SignIn /> },
      { path: '/signup', element: <SignUp /> },
    ],
  },
];
export default routes;
