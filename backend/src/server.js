const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./auth/routes');
const errorMiddleware = require('./middlewares/error.middleware');
const { swaggerUi, specs } = require('./config/swagger');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { swaggerOptions: { url: '/api-docs.json' } }));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use(errorMiddleware.notFoundHandler);

// Global error handler
app.use(errorMiddleware.errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});

module.exports = app;