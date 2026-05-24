/**
 * Global error handling middleware
 */
exports.errorHandler = (error, req, res, next) => {
  // Log error
  console.error('Error:', error.message);

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  // Handle validation errors
  if (error.message.includes('required')) {
    statusCode = 400;
    message = error.message;
  }

  // Handle authentication errors
  if (error.message.includes('Invalid') || error.message.includes('already')) {
    statusCode = 401;
    message = error.message;
  }

  // Handle unique constraint errors (from Prisma)
  if (error.code === 'P2002') {
    statusCode = 400;
    const field = error.meta?.target?.[0];
    message = `${field} already exists`;
  }

  // Handle record not found errors
  if (error.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
  });
};

/**
 * 404 handler
 */
exports.notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};
