import { Router } from 'express';
import { adminAuth } from '@/middleware/adminAuth';
import { login, listClusters, listUsers, getStats, createCluster, deleteCluster } from './controllers/admin.controller';

const router = Router();

// The admin route prefix is configurable via ADMIN_ROUTE_SLUG env var.
// This avoids exposing a predictable /admin path. Default fallback is
// a random-looking slug so the route is never guessable by default.
const SLUG = process.env.ADMIN_ROUTE_SLUG;

if (!SLUG) {
  throw new Error('ADMIN_ROUTE_SLUG env var is required');
}

router.post(`/${SLUG}/login`, login);

// Everything below requires a valid admin JWT (isAdmin claim).
router.use(`/${SLUG}`, adminAuth);
router.get(`/${SLUG}/clusters`, listClusters);
router.get(`/${SLUG}/users`, listUsers);
router.get(`/${SLUG}/stats`, getStats);
router.post(`/${SLUG}/clusters`, createCluster);
router.delete(`/${SLUG}/clusters/:id`, deleteCluster);

export default router;
export { SLUG };
