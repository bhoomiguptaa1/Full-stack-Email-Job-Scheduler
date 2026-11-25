class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
}

function errorHandler(err, req, res, _next) {
  const { logger } = require('../utils/logger');
  const { ENV } = require('../config/env');

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    res.status(409).json({
      success: false,
      error: 'A record with this unique value already exists.',
      code: 'CONFLICT',
    });
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format.',
      code: 'INVALID_ID',
    });
    return;
  }

  if (err instanceof SyntaxError && err.status === 400) {
    res.status(400).json({
      success: false,
      error: 'Malformed JSON request payload',
      code: 'INVALID_JSON',
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error('[Unhandled Error]', { method: req.method, path: req.originalUrl, error: message });

  res.status(500).json({
    success: false,
    error: ENV.NODE_ENV === 'production' ? 'Internal server error' : message,
    code: 'INTERNAL_ERROR',
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
