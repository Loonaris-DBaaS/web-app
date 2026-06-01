import { NextFunction, Request, Response } from 'express';
import * as loadTest from './service';

export async function metrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { connectionString } = req.body as { connectionString?: string };
    if (!connectionString) {
      res.status(400).json({ success: false, message: 'connectionString is required' });
      return;
    }
    const data = await loadTest.metricsForConnectionString(connectionString);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message });
    void next;
  }
}

export async function start(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { connectionString, concurrency, durationSec } = req.body as {
      connectionString?: string;
      concurrency?: number;
      durationSec?: number;
    };
    if (!connectionString) {
      res.status(400).json({ success: false, message: 'connectionString is required' });
      return;
    }
    const result = await loadTest.startLoad(connectionString, { concurrency, durationSec });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message });
    void next;
  }
}

export function status(req: Request, res: Response): void {
  const data = loadTest.loadStatus(req.params['runId'] as string);
  if (!data) {
    res.status(404).json({ success: false, message: 'Run not found' });
    return;
  }
  res.json({ success: true, data });
}

export function stop(req: Request, res: Response): void {
  const ok = loadTest.stopLoad(req.params['runId'] as string);
  if (!ok) {
    res.status(404).json({ success: false, message: 'Run not found' });
    return;
  }
  res.json({ success: true, data: { stopped: true } });
}
