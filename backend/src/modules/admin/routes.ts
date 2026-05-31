import { Router } from 'express';
import { adminAuth } from '@/middleware/adminAuth';
import { login, listClusters, createCluster, deleteCluster } from './controllers/admin.controller';

const router = Router();

// Public: hardcoded platform-admin login → returns an admin JWT.
router.post('/login', login); // POST /api/admin/login

// Everything below requires a valid admin JWT (isAdmin claim).
router.use(adminAuth);
router.get('/clusters', listClusters); // GET    /api/admin/clusters
router.post('/clusters', createCluster); // POST   /api/admin/clusters
router.delete('/clusters/:id', deleteCluster); // DELETE /api/admin/clusters/:id

export default router;
