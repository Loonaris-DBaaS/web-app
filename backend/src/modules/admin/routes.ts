import { Router } from 'express';
import { listClusters, deleteCluster } from './controllers/admin.controller';

// NOTE: intentionally UNAUTHENTICATED for now (testing convenience). Gate this
// behind an admin auth check before exposing publicly.
const router = Router();

router.get('/clusters', listClusters); // GET    /api/admin/clusters
router.delete('/clusters/:id', deleteCluster); // DELETE /api/admin/clusters/:id

export default router;
