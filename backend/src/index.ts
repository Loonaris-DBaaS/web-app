import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './config/openapi';
import authRoutes from './modules/auth/routes';
import pgClusterRoutes from './modules/pgCluster/routes';
import testAppRoutes from './modules/testApp/routes';

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Liveness probe for the ALB target group / ECS — intentionally does NOT touch
// the DB so the task reports healthy even before RDS is wired up.
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'hello world from ci/cd v3' });
});

apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
apiRouter.use('/auth', authRoutes);
apiRouter.use('/clusters', pgClusterRoutes);
apiRouter.use('/test', testAppRoutes);

app.use('/api', apiRouter);

// Global error handler
app.use((err: Error & { code?: string; meta?: { target?: string[] } }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] ?? 'field';
    res.status(400).json({ success: false, message: `${field} already exists` });
    return;
  }
  if (err.code === 'P2025') {
    res.status(404).json({ success: false, message: 'Record not found' });
    return;
  }
  if (err.message.includes('Invalid') || err.message.includes('already') || err.message.includes('required')) {
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/api/docs`);
});
