import { Request, Response, NextFunction } from 'express';
import { lookupRoute } from '../services/internal.service';

export async function getRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const keyHash = req.params.keyHash as string;
    if (!keyHash || !/^[a-f0-9]{64}$/.test(keyHash)) {
      res.status(400).json({ error: 'Invalid key hash format' });
      return;
    }

    const route = await lookupRoute(keyHash);
    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    res.json(route);
  } catch (err) {
    next(err);
  }
}
