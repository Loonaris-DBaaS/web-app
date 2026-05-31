import { NextFunction, Request, Response } from 'express';
import { CreateClusterDto, PgVersion, ClusterSize } from '../dto/create-cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import * as pgClusterService from '../services/pgCluster.service';

function tenantId(req: Request): string {
  return req.user?.tenantId as string;
}

const VALID_PG_VERSIONS: PgVersion[] = ['16', '17', '18'];
const VALID_SIZES: ClusterSize[] = ['starter', 'pro', 'scale'];

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const clusters = await pgClusterService.listClusters(tenantId(req));
    res.json({ success: true, data: clusters });
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const cluster = await pgClusterService.getCluster(tenantId(req), req.params['id'] as string);
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }
    res.json({ success: true, data: cluster });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const dto = req.body as CreateClusterDto;

  if (!dto.name || !dto.region || !dto.pgVersion || !dto.size || !dto.instances) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  if (!VALID_PG_VERSIONS.includes(dto.pgVersion)) {
    res.status(400).json({ error: `pgVersion must be one of: ${VALID_PG_VERSIONS.join(', ')}` });
    return;
  }
  if (!VALID_SIZES.includes(dto.size)) {
    res.status(400).json({ error: `size must be one of: ${VALID_SIZES.join(', ')}` });
    return;
  }

  try {
    const cluster = await pgClusterService.createCluster(tenantId(req), dto);
    res.status(202).json({ success: true, data: cluster });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const dto = req.body as UpdateClusterDto;

  if (
    dto.name === undefined &&
    dto.region === undefined &&
    dto.pgVersion === undefined &&
    dto.cpu === undefined &&
    dto.ram === undefined &&
    dto.storage === undefined &&
    dto.instances === undefined &&
    dto.backup === undefined &&
    dto.autoscale === undefined
  ) {
    res.status(400).json({ error: 'At least one field is required' });
    return;
  }

  try {
    const cluster = await pgClusterService.updateCluster(tenantId(req), req.params['id'] as string, dto);
    if (!cluster) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }
    res.json({ success: true, data: cluster });
  } catch (err) {
    next(err);
  }
}

export async function regenerateKey(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pgClusterService.regenerateApiKey(tenantId(req), req.params['id'] as string);
    if (!result) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await pgClusterService.getClusterMetrics(tenantId(req), req.params['id'] as string);
    if (!metrics) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await pgClusterService.deleteCluster(tenantId(req), req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ error: 'Cluster not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
