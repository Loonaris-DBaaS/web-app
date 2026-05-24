import { Router } from 'express';
import { validateSignup, validateLogin } from '@/middleware/validate';
import { authenticate } from '@/middleware/authenticate';
import { signup } from './controllers/signup.controller';
import { login, refreshToken, logout } from './controllers/login.controller';
import { getProfile, updateProfile, deleteAccount } from './controllers/profile.controller';

const router = Router();

router.post('/signup', validateSignup, signup);           // POST /auth/signup
router.post('/login', validateLogin, login);               // POST /auth/login
router.post('/refresh-token', refreshToken);               // POST /auth/refresh-token
router.post('/logout', logout);                            // POST /auth/logout
router.get('/profile', authenticate, getProfile);          // GET  /auth/profile
router.patch('/profile', authenticate, updateProfile);     // PATCH /auth/profile
router.delete('/account', authenticate, deleteAccount);    // DELETE /auth/account

export default router;
