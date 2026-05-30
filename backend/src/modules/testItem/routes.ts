import { Router } from 'express';
import { index, show, create, update, remove } from './controllers/testItem.controller';

const router = Router();

router.get('/', index);       // GET    /test-items
router.get('/:id', show);     // GET    /test-items/:id
router.post('/', create);     // POST   /test-items
router.put('/:id', update);   // PUT    /test-items/:id
router.delete('/:id', remove); // DELETE /test-items/:id

export default router;
