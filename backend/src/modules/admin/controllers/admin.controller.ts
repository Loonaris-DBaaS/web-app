import { Request, Response, NextFunction } from 'express';
import * as pgClusterService from '@/modules/pgCluster/services/pgCluster.service';
import type {
  CreateClusterDto,
  PgVersion,
  ClusterSize,
} from '@/modules/pgCluster/dto/create-cluster.dto';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const VALID_PG_VERSIONS: PgVersion[] = ['16', '17', '18'];
const VALID_SIZES: ClusterSize[] = ['starter', 'standard', 'pro'];
const SUPPORTED_REGIONS = ['eu-west-3'];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.warn('[admin] ADMIN_EMAIL and ADMIN_PASSWORD env vars are required for admin login.');
}

// POST /{slug}/login — platform-admin login (requires valid ADMIN_EMAIL + ADMIN_PASSWORD).
// On success, ensures a backing tenant row exists and returns an 8h admin JWT
// whose isAdmin claim passes adminAuth.
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      res.status(503).json({ success: false, message: 'Admin login not configured' });
      return;
    }
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      return;
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await prisma.tenant.upsert({
      where: { email: ADMIN_EMAIL },
      update: { isAdmin: true },
      create: { email: ADMIN_EMAIL, username: `platform-admin-${Date.now()}`, passwordHash, isAdmin: true },
    });
    const accessToken = jwt.sign({ id: admin.id, tenantId: admin.id, isAdmin: true }, JWT_SECRET, {
      expiresIn: '8h',
    });
    res.status(200).json({ success: true, data: { accessToken, email: ADMIN_EMAIL } });
  } catch (err) {
    next(err);
  }
}

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
      res
        .status(400)
        .json({
          success: false,
          message: `pgVersion must be one of: ${VALID_PG_VERSIONS.join(', ')}`,
        });
      return;
    }

    const size = (body.size ?? 'starter') as ClusterSize;
    if (!VALID_SIZES.includes(size)) {
      res
        .status(400)
        .json({ success: false, message: `size must be one of: ${VALID_SIZES.join(', ')}` });
      return;
    }

    const region = body.region ?? 'eu-west-3';
    if (!SUPPORTED_REGIONS.includes(region)) {
      res
        .status(400)
        .json({
          success: false,
          message: `region must be one of: ${SUPPORTED_REGIONS.join(', ')}`,
        });
      return;
    }

    // Owner tenant: explicit tenantId, or fall back to the admin's own tenant.
    const ownerId = body.tenantId ?? (req.user?.id as string | undefined);
    if (!ownerId) {
      res
        .status(400)
        .json({ success: false, message: 'No owner tenant resolved (provide tenantId)' });
      return;
    }
    const owner = await prisma.tenant.findUnique({ where: { id: ownerId } });
    if (!owner) {
      res.status(404).json({ success: false, message: 'Target tenant not found' });
      return;
    }

    const dto: CreateClusterDto = {
      name: body.name.trim(),
      region,
      pgVersion,
      size,
      // Pinned to 1: default for admin-created clusters.
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
