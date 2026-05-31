import { Request, Response, NextFunction } from 'express';
import * as pgClusterService from '@/modules/pgCluster/services/pgCluster.service';

// GET /api/admin/clusters — every tenant's clusters, with owner info.
export async function listClusters(_req: Request, res: Response, next: NextFunction) {
  try {
    const clusters = await pgClusterService.listAllClusters();
    res.json({ success: true, count: clusters.length, data: clusters });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/clusters/:id — deprovision any cluster by id.
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
