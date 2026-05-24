import { Request, Response } from 'express';
import * as testAppService from '../services/testApp.service';

export async function index(_req: Request, res: Response): Promise<void> {
  const items = await testAppService.list();
  res.json(items);
}

export async function show(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const item = await testAppService.get(id);
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(item);
}

export async function create(req: Request, res: Response): Promise<void> {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const item = await testAppService.create(name);
  res.status(201).json(item);
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const item = await testAppService.update(id, name);
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(item);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const deleted = await testAppService.remove(id);
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).send();
}
