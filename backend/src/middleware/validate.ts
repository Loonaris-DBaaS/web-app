import { Request, Response, NextFunction } from 'express';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateSignup(req: Request, res: Response, next: NextFunction): void {
  const { username, email, password } = req.body as Record<string, string>;
  const errors: string[] = [];

  if (!username || username.trim().length < 3)
    errors.push('Username must be at least 3 characters');
  if (!email || !isValidEmail(email)) errors.push('Email must be valid');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');

  if (errors.length > 0) {
    const passwordError = errors.find(e => e.includes('Password'));
    const message = passwordError ? 'short password' : 'Validation failed';
    res.status(400).json({ success: false, message, errors });
    return;
  }
  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body as Record<string, string>;
  const errors: string[] = [];

  if (!email || !isValidEmail(email)) errors.push('Email must be valid');
  if (!password) errors.push('Password is required');

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }
  next();
}
