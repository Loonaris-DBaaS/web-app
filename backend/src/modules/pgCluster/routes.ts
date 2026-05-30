import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { index, show, create, update, remove } from './controllers/pgCluster.controller';

const router = Router();

router.get('/', authenticate, index); // GET  /clusters
router.get('/:id', authenticate, show); // GET  /clusters/:id
router.post('/', authenticate, create); // POST /clusters
router.patch('/:id', authenticate, update); // PATCH /clusters/:id
router.delete('/:id', authenticate, remove); // DELETE /clusters/:id

export default router;
