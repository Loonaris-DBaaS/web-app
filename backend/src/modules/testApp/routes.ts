import { Router } from 'express';
import { index, show, create, update, remove } from './controllers/testApp.controller';

const router = Router();

router.get('/', index); // GET    /test
router.get('/:id', show); // GET    /test/:id
router.post('/', create); // POST   /test
router.put('/:id', update); // PUT    /test/:id
router.delete('/:id', remove); // DELETE /test/:id

export default router;
