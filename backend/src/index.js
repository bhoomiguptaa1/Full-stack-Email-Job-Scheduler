const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { ENV } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { disconnectRedis } = require('./config/redis');
const { setupBullBoard } = require('./queues/board');
const { emailQueue } = require('./queues/email.queue');
const { apiRouter } = require('./routes');
const { createEmailWorker } = require('./workers/email.worker');
const { createHttpRateLimiter } = require('./middleware/rateLimit.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { logger } = require('./utils/logger');

const app = express();

app.use('/api', helmet());
app.use('/admin/queues', helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = new Set([ENV.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']);
      if (!origin || allowed.has(origin) || /^https:\/\/[^.]+\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));

// BullMQ Monitoring Dashboard
try {
  const bullBoardAdapter = setupBullBoard();
  app.use('/admin/queues', bullBoardAdapter.getRouter());
} catch (err) {
  logger.warn('[Bull-Board] Disabled (UI assets not available in this runtime)', {
    error: err instanceof Error ? err.message : String(err),
  });
}

// API rate limiting + REST API routes
const apiLimiter = createHttpRateLimiter({
  keyPrefix: 'api',
  windowSeconds: 60,
  maxRequests: ENV.API_RATE_LIMIT_MAX,
});
app.use('/api', apiLimiter, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

let worker = null;
let server = null;

async function shutdown(signal) {
  logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);
  if (server) await new Promise((resolve) => server.close(resolve));
  if (worker) await worker.close().catch(() => {});
  await emailQueue.close().catch(() => {});
  await disconnectRedis().catch(() => {});
  await disconnectDB().catch(() => {});
  process.exit(0);
}

async function startServer() {
  await connectDB();

  if (process.env.RUN_IN_PROCESS_WORKER !== 'false') {
    worker = createEmailWorker();
    logger.info('[BullMQ] Worker started in-process.', { concurrency: ENV.WORKER_CONCURRENCY });
  }

  server = app.listen(ENV.PORT, () => {
    logger.info(`ReachInbox API Server running on port ${ENV.PORT}`);
    logger.info(`Bull-Board Dashboard: http://localhost:${ENV.PORT}/admin/queues`);
    logger.info(`Health check: http://localhost:${ENV.PORT}/api/health`);
  });

  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Fatal error starting server', { error: err.message });
    process.exit(1);
  });
}

module.exports = { app };
