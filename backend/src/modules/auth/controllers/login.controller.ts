import { Request, Response, NextFunction } from 'express';
import * as loginService from '../services/login.service';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await loginService.login(email, password);

    res.cookie('refreshToken', user.refreshToken, COOKIE_OPTS);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        country: user.country,
        photoUrl: user.photoUrl,
        isAdmin: user.isAdmin,
        accessToken: user.accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      (req.cookies as Record<string, string>)['refreshToken'] ??
      (req.body as { refreshToken?: string }).refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token is required' });
      return;
    }
    const { accessToken } = await loginService.refreshAccessToken(token);
    res
      .status(200)
      .json({ success: true, message: 'Access token refreshed', data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      (req.cookies as Record<string, string>)['refreshToken'] ??
      (req.body as { refreshToken?: string }).refreshToken;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token is required' });
      return;
    }
    await loginService.logout(token);
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
