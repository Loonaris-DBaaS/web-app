import { Request, Response, NextFunction } from 'express';
import * as pgClusterService from '@/modules/pgCluster/services/pgCluster.service';
import type { CreateClusterDto, PgVersion, ClusterSize } from '@/modules/pgCluster/dto/create-cluster.dto';
import prisma from '@/lib/prisma';

const VALID_PG_VERSIONS: PgVersion[] = ['16', '17', '18'];
const VALID_SIZES: ClusterSize[] = ['starter', 'pro', 'scale'];

// GET /api/admin/clusters — every tenant's clusters, with owner info.
export async function listClusters(_req: Request, res: Response, next: NextFunction) {
  try {
    const clusters = await pgClusterService.listAllClusters();
    res.json({ success: true, count: clusters.length, data: clusters });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/clusters — provision a cluster as admin.
// Owner = body.tenantId if provided (must exist), else the authenticated admin's
// own tenant. Returns the sk_live_ key once (admin must copy it now).
export async function createCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Partial<CreateClusterDto> & { tenantId?: string };

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }

    const pgVersion = (body.pgVersion ?? '17') as PgVersion;
    if (!VALID_PG_VERSIONS.includes(pgVersion)) {
      res.status(400).json({ success: false, message: `pgVersion must be one of: ${VALID_PG_VERSIONS.join(', ')}` });
      return;
    }

    const size = (body.size ?? 'starter') as ClusterSize;
    if (!VALID_SIZES.includes(size)) {
      res.status(400).json({ success: false, message: `size must be one of: ${VALID_SIZES.join(', ')}` });
      return;
    }

    // Owner tenant: explicit tenantId, or fall back to the admin's own tenant.
    const ownerId = body.tenantId ?? (req.user?.id as string | undefined);
    if (!ownerId) {
      res.status(400).json({ success: false, message: 'No owner tenant resolved (provide tenantId)' });
      return;
    }
    const owner = await prisma.tenant.findUnique({ where: { id: ownerId } });
    if (!owner) {
      res.status(404).json({ success: false, message: 'Target tenant not found' });
      return;
    }

    const dto: CreateClusterDto = {
      name: body.name.trim(),
      region: body.region ?? 'eu-west-3',
      pgVersion,
      size,
      // Pinned to 1: tenant nodes are capped at max-pods=11 (see docs/GAPS.md).
      instances: 1,
      backup: body.backup ?? false,
    };

    const cluster = await pgClusterService.createCluster(ownerId, dto);
    res.status(202).json({ success: true, message: 'Cluster creation started', data: cluster });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/clusters/:id — deprovision any cluster by id, then remove the row.
export async function deleteCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await pgClusterService.deleteAnyCluster(req.params.id as string);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }
    res.status(202).json({ success: true, message: 'Cluster deletion started' });
  } catch (err) {
    next(err);
  }
}
