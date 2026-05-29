import { NextFunction, Request, Response } from 'express';
import { CreateClusterDto, DeploymentOption, PgVersion, ClusterSize } from '../dto/create-cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import * as pgClusterService from '../services/pgCluster.service';

function tenantId(req: Request): string {
  return req.user?.tenantId as string;
}

const VALID_PG_VERSIONS: PgVersion[] = ['16', '17', '18'];
const VALID_SIZES: ClusterSize[] = ['starter', 'pro', 'scale'];
const VALID_DEPLOYMENT_OPTIONS: DeploymentOption[] = ['MULTI_AZ_CLUSTER', 'MULTI_AZ_INSTANCE', 'SINGLE_AZ_INSTANCE'];

export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clusters = await pgClusterService.listClusters(tenantId(req));
    res.json(clusters);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cluster = await pgClusterService.getCluster(tenantId(req), req.params['id'] as string);
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
  const dto = req.body as CreateClusterDto;

  if (!dto.name || !dto.region || !dto.pgVersion || !dto.size || !dto.deploymentOption) {
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
  if (!VALID_DEPLOYMENT_OPTIONS.includes(dto.deploymentOption)) {
    res.status(400).json({ error: `deploymentOption must be one of: ${VALID_DEPLOYMENT_OPTIONS.join(', ')}` });
    return;
  }

  try {
    const cluster = await pgClusterService.createCluster(tenantId(req), dto);
    res.status(202).json(cluster); // 202 Accepted — provisioning is async
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const cluster = await pgClusterService.updateCluster(tenantId(req), req.params['id'] as string, dto);
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
