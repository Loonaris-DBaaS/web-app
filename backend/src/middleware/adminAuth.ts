import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';

// Mirrors `authenticate` (same JWT secret) but additionally requires the token's
// `isAdmin` claim to be true. Missing/invalid token → 401; non-admin → 403.
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.split(' ')[1] as string;
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  if (payload.isAdmin !== true) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }
  req.user = payload;
  next();
}
