import { Router } from 'express';
import { internalAuth } from '@/middleware/internalAuth';
import { getRoute } from './controllers/internal.controller';

const router = Router();

router.get('/routes/:keyHash', internalAuth, getRoute);

export default router;
