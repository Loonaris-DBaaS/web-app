import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './config/openapi';
import pgClusterRoutes from './modules/pgCluster/routes';
import testAppRoutes from './modules/testApp/routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Module routes
app.use('/clusters', pgClusterRoutes);
app.use('/test', testAppRoutes);

// TODO: mount auth routes once auth module controllers are implemented
// app.use('/auth', authRoutes);

// Global error handler — must be last middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/docs`);
});
