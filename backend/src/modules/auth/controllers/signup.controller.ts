import { Request, Response, NextFunction } from 'express';
import * as signupService from '../services/signup.service';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password, country } = req.body as {
      username: string;
      email: string;
      password: string;
      country?: string;
    };
    const user = await signupService.signup({ username, email, password, country });
    res.status(201).json({ success: true, message: 'User created successfully', data: user });
  } catch (err) {
    next(err);
  }
}
