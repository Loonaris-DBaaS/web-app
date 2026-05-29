import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { CreateClusterDto } from '../dto/create-cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import * as pgClusterService from '../services/pgCluster.service';

export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = req.user as JwtPayload & { tenantId: string };
    const clusters = await pgClusterService.listClusters(tenantId);
    res.json(clusters);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = req.user as JwtPayload & { tenantId: string };
    const cluster = await pgClusterService.getCluster(tenantId, req.params['id'] as string);
    if (!cluster) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }
    res.json(cluster);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { tenantId } = req.user as JwtPayload & { tenantId: string };
  const dto = req.body as CreateClusterDto;

  if (!dto.name || !dto.region || !dto.pgVersion || !dto.size || !dto.deploymentOption) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const cluster = await pgClusterService.createCluster(tenantId, dto);
    res.status(202).json(cluster); // 202 Accepted — provisioning is async
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { tenantId } = req.user as JwtPayload & { tenantId: string };
  const dto = req.body as UpdateClusterDto;

  if (
    dto.name === undefined &&
    dto.region === undefined &&
    dto.pgVersion === undefined &&
    dto.size === undefined &&
    dto.deploymentOption === undefined &&
    dto.readReplicas === undefined &&
    dto.backup === undefined
  ) {
    res.status(400).json({ error: 'At least one field is required' });
    return;
  }

  try {
    const cluster = await pgClusterService.updateCluster(tenantId, req.params['id'] as string, dto);
    if (!cluster) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }

    res.json(cluster);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = req.user as JwtPayload & { tenantId: string };
    const deleted = await pgClusterService.deleteCluster(tenantId, req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
