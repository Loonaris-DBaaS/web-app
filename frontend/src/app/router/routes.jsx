import Landing from'../../pages/Landing/Landing';
import AuthLayout from '../../layouts/AuthLayout';
import SignIn from '../../pages/SignIn/SignIn';
import SignUp from '../../pages/SignUp/SignUp';
const routes = [
    {
        path:'/',
        element:<Landing/>
    },
    {
        element : <AuthLayout/>,
        children: [
            { path: '/signin', element: <SignIn /> },
            { path: '/signup', element: <SignUp /> },
        ],
    }
]
export default routes