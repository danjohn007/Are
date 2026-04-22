import logger from '../config/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
}

export function errorHandler(error, _req, res, _next) {
  logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode
  });

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
}
