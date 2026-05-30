import { Request, Response, NextFunction } from 'express';

const GATEWAY_SECRET = process.env.INTERNAL_GATEWAY_SECRET;

export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!GATEWAY_SECRET) {
    console.error('[internalAuth] INTERNAL_GATEWAY_SECRET is not set');
    res.status(500).json({ error: 'Internal authentication not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== GATEWAY_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
