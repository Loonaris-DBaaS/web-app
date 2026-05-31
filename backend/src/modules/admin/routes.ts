import { Router } from 'express';
import { adminAuth } from '@/middleware/adminAuth';
import { listClusters, createCluster, deleteCluster } from './controllers/admin.controller';

// All admin routes require a valid JWT whose tenant has isAdmin === true.
const router = Router();
router.use(adminAuth);

router.get('/clusters', listClusters); // GET    /api/admin/clusters
router.post('/clusters', createCluster); // POST   /api/admin/clusters
router.delete('/clusters/:id', deleteCluster); // DELETE /api/admin/clusters/:id

export default router;
