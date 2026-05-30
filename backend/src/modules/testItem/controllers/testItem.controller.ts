import { Request, Response } from 'express';
import * as testItemService from '../services/testItem.service';

export async function index(_req: Request, res: Response): Promise<void> {
  const items = await testItemService.list();
  res.json({ success: true, data: items });
}

export async function show(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);
  if (!id || id === 'undefined') {
    res.status(400).json({ success: false, message: 'id is required' });
    return;
  }
  const item = await testItemService.get(id);
  if (!item) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }
  res.json({ success: true, data: item });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { title, description } = req.body as { title?: string; description?: string };
  if (!title) {
    res.status(400).json({ success: false, message: 'title is required' });
    return;
  }
  const item = await testItemService.create({ title, description });
  res.status(201).json({ success: true, data: item });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);
  if (!id || id === 'undefined') {
    res.status(400).json({ success: false, message: 'id is required' });
    return;
  }
  const { title, description, completed } = req.body as {
    title?: string;
    description?: string;
    completed?: boolean;
  };
  const item = await testItemService.update(id, { title, description, completed });
  if (!item) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }
  res.json({ success: true, data: item });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id']);
  if (!id || id === 'undefined') {
    res.status(400).json({ success: false, message: 'id is required' });
    return;
  }
  const deleted = await testItemService.remove(id);
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }
  res.status(204).send();
}
