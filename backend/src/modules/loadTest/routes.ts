import { Router } from 'express';
import { metrics, start, status, stop } from './controller';

// Public, unauthenticated load-test endpoints powering the /test dashboard.
// Auth is intentionally omitted: possession of a valid sk_live_ connection
// string is the only credential, and the host is allow-listed in the service.
const router = Router();

router.post('/metrics', metrics); // POST /load-test/metrics  { connectionString }
router.post('/start', start); // POST /load-test/start    { connectionString, concurrency?, durationSec? }
router.get('/:runId', status); // GET  /load-test/:runId
router.post('/:runId/stop', stop); // POST /load-test/:runId/stop

export default router;
